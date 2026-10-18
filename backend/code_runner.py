"""Run short user snippets (Python / JavaScript / Java).

Hardening, because logged-in users can run arbitrary code on the API host:
  * the child gets a minimal environment, so DATABASE_URL and OAuth secrets are not exposed;
  * when the API runs as root (as in the Docker image) the child drops to the unprivileged
    `nobody` user, so it cannot read the API process's /proc/<pid>/environ or its files;
  * CPU time, file size and process count are limited with `prlimit` (when available);
  * stdout/stderr go to size-capped temp files, and the whole process group is killed after the run.

This is defence in depth, not a full sandbox: network access is not blocked and code shares
the API container's kernel. For a public deployment, move execution to an isolated service.
"""

import os
import re
import shutil
import signal
import subprocess
import sys
import tempfile
from pathlib import Path

ALLOWED = {"python", "javascript", "java"}
TIMEOUT_SEC = 8
MAX_OUTPUT = 12_000
NOBODY = 65534
FSIZE_LIMIT = 2 * 1024 * 1024


def _trim(text: str) -> str:
    if len(text) > MAX_OUTPUT:
        return text[:MAX_OUTPUT] + "\n… (output truncated)"
    return text


def _result(lang, stdout="", stderr="", exit_code=0, timed_out=False) -> dict:
    return {"language": lang, "stdout": stdout, "stderr": stderr,
            "exit_code": exit_code, "timed_out": timed_out}


def _clean_env(tmp: Path) -> dict:
    return {
        "PATH": os.environ.get("PATH", "/usr/local/bin:/usr/bin:/bin"),
        "HOME": str(tmp),
        "TMPDIR": str(tmp),
        "LANG": "C.UTF-8",
        "PYTHONUTF8": "1",
    }


def _limited(cmd: list[str], *, address_space: bool = False) -> list[str]:
    prlimit = shutil.which("prlimit")
    if not prlimit:
        return cmd
    limits = [f"--cpu={TIMEOUT_SEC + 2}", f"--fsize={FSIZE_LIMIT}", "--nproc=512", "--core=0"]
    if address_space:
        limits.append(f"--as={1024 * 1024 * 1024}")
    return [prlimit, *limits, "--", *cmd]


def _chown_tree(path: Path) -> None:
    os.chown(path, NOBODY, NOBODY)
    path.chmod(0o700)
    for child in path.iterdir():
        os.chown(child, NOBODY, NOBODY)


def _run(cmd: list[str], tmp: Path, timeout: int) -> tuple[int, str, str, bool]:
    """Run cmd in tmp; returns (exit_code, stdout, stderr, timed_out)."""
    kwargs = {}
    if os.geteuid() == 0:
        _chown_tree(tmp)
        kwargs.update(user=NOBODY, group=NOBODY, extra_groups=[])
    out_path, err_path = tmp.parent / f"{tmp.name}.out", tmp.parent / f"{tmp.name}.err"
    try:
        with open(out_path, "wb") as out, open(err_path, "wb") as err:
            proc = subprocess.Popen(
                cmd, cwd=tmp, stdin=subprocess.DEVNULL, stdout=out, stderr=err,
                env=_clean_env(tmp), start_new_session=True, **kwargs,
            )
            timed_out = False
            try:
                proc.wait(timeout=timeout)
            except subprocess.TimeoutExpired:
                timed_out = True
            finally:
                # Always kill the whole group so forked children never outlive the run.
                try:
                    os.killpg(proc.pid, signal.SIGKILL)
                except ProcessLookupError:
                    pass
            proc.wait()
        read = lambda p: p.read_bytes()[: MAX_OUTPUT * 4].decode("utf-8", "replace")  # noqa: E731
        return proc.returncode, read(out_path), read(err_path), timed_out
    finally:
        out_path.unlink(missing_ok=True)
        err_path.unlink(missing_ok=True)


def run_code(language: str, code: str) -> dict:
    lang = (language or "").strip().lower()
    if lang in {"js", "node"}:
        lang = "javascript"
    if lang not in ALLOWED:
        return _result(language, stderr="Unsupported language. Use python, javascript, or java.", exit_code=1)

    tmp = Path(tempfile.mkdtemp(prefix="focusstack-lab-"))
    try:
        if lang == "python":
            script = tmp / "main.py"
            script.write_text(code, encoding="utf-8")
            cmd = _limited([sys.executable, "-I", str(script)], address_space=True)
        elif lang == "javascript":
            node = shutil.which("node")
            if not node:
                return _result(lang, stderr="Node.js is not installed or not on PATH.", exit_code=1)
            script = tmp / "main.js"
            script.write_text(code, encoding="utf-8")
            cmd = _limited([node, "--max-old-space-size=256", str(script)])
        else:
            javac, java = shutil.which("javac"), shutil.which("java")
            if not javac or not java:
                return _result(lang, stderr="JDK not found. Install Java (javac + java) to run snippets.", exit_code=1)
            match = re.search(r"public\s+class\s+(\w+)", code)
            classname = match.group(1) if match else "Main"
            if "class " not in code:
                code = (
                    "public class Main {\n"
                    "  public static void main(String[] args) {\n"
                    f"{code}\n"
                    "  }\n"
                    "}\n"
                )
                classname = "Main"
            source = tmp / f"{classname}.java"
            source.write_text(code, encoding="utf-8")
            rc, out, err, timed_out = _run(
                _limited([javac, "-J-XX:-UsePerfData", "-J-Xmx256m", str(source)]), tmp, TIMEOUT_SEC
            )
            if timed_out:
                return _result(lang, stderr=f"Timed out after {TIMEOUT_SEC}s.", exit_code=124, timed_out=True)
            if rc != 0:
                return _result(lang, _trim(out), _trim(err or "Compile failed"), rc)
            cmd = _limited([java, "-XX:-UsePerfData", "-Xmx256m", "-Xss512k", "-cp", str(tmp), classname])

        rc, out, err, timed_out = _run(cmd, tmp, TIMEOUT_SEC)
        if timed_out:
            return _result(lang, stderr=f"Timed out after {TIMEOUT_SEC}s.", exit_code=124, timed_out=True)
        return _result(lang, _trim(out), _trim(err), rc)
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
