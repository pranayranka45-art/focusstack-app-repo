import os
import shutil
import subprocess
import sys
import tempfile
import re
from pathlib import Path

ALLOWED = {"python", "javascript", "java"}
TIMEOUT_SEC = 8
MAX_OUTPUT = 12_000


def _trim(text: str) -> str:
    if len(text) > MAX_OUTPUT:
        return text[:MAX_OUTPUT] + "\n… (output truncated)"
    return text


def run_code(language: str, code: str) -> dict:
    lang = (language or "").strip().lower()
    if lang in {"js", "node"}:
        lang = "javascript"
    if lang not in ALLOWED:
        return {
            "language": language,
            "stdout": "",
            "stderr": f"Unsupported language. Use python, javascript, or java.",
            "exit_code": 1,
            "timed_out": False,
        }

    tmp = Path(tempfile.mkdtemp(prefix="focusstack-lab-"))
    try:
        if lang == "python":
            script = tmp / "main.py"
            script.write_text(code, encoding="utf-8")
            cmd = [sys.executable, "-I", str(script)]
        elif lang == "javascript":
            script = tmp / "main.js"
            script.write_text(code, encoding="utf-8")
            node = shutil.which("node")
            if not node:
                return {
                    "language": lang,
                    "stdout": "",
                    "stderr": "Node.js is not installed or not on PATH.",
                    "exit_code": 1,
                    "timed_out": False,
                }
            cmd = [node, str(script)]
        else:
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
            javac = shutil.which("javac")
            java = shutil.which("java")
            if not javac or not java:
                return {
                    "language": lang,
                    "stdout": "",
                    "stderr": "JDK not found. Install Java (javac + java) to run snippets.",
                    "exit_code": 1,
                    "timed_out": False,
                }
            compile_proc = subprocess.run(
                [javac, str(source)],
                cwd=tmp,
                capture_output=True,
                text=True,
                timeout=TIMEOUT_SEC,
            )
            if compile_proc.returncode != 0:
                return {
                    "language": lang,
                    "stdout": _trim(compile_proc.stdout or ""),
                    "stderr": _trim(compile_proc.stderr or "Compile failed"),
                    "exit_code": compile_proc.returncode,
                    "timed_out": False,
                }
            cmd = [java, "-cp", str(tmp), classname]

        env = os.environ.copy()
        env["PYTHONUTF8"] = "1"
        proc = subprocess.run(
            cmd,
            cwd=tmp,
            capture_output=True,
            text=True,
            timeout=TIMEOUT_SEC,
            env=env,
        )
        return {
            "language": lang,
            "stdout": _trim(proc.stdout or ""),
            "stderr": _trim(proc.stderr or ""),
            "exit_code": proc.returncode,
            "timed_out": False,
        }
    except subprocess.TimeoutExpired:
        return {
            "language": lang,
            "stdout": "",
            "stderr": f"Timed out after {TIMEOUT_SEC}s.",
            "exit_code": 124,
            "timed_out": True,
        }
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
