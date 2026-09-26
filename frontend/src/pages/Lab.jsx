import { useEffect, useState } from 'react';
import { api } from '../api';

const LANGS = [
  { id: 'python', label: 'Python', sample: 'print("hello from FocusStack")\nfor i in range(3):\n    print(i)' },
  {
    id: 'javascript',
    label: 'JavaScript',
    sample: 'const sum = (a, b) => a + b;\nconsole.log("2 + 3 =", sum(2, 3));',
  },
  {
    id: 'java',
    label: 'Java',
    sample:
      'public class Main {\n  public static void main(String[] args) {\n    System.out.println("FocusStack lab");\n    System.out.println(21 * 2);\n  }\n}',
  },
];

export default function Lab() {
  const [snippets, setSnippets] = useState([]);
  const [active, setActive] = useState(null);
  const [title, setTitle] = useState('Cell 1');
  const [language, setLanguage] = useState('python');
  const [code, setCode] = useState(LANGS[0].sample);
  const [output, setOutput] = useState('');
  const [running, setRunning] = useState(false);

  async function load() {
    const list = await api.getSnippets();
    setSnippets(list);
  }

  useEffect(() => {
    load().catch(console.error);
  }, []);

  function loadSnippet(s) {
    setActive(s.id);
    setTitle(s.title);
    setLanguage(s.language);
    setCode(s.code);
    setOutput(s.last_output || '');
  }

  async function save() {
    if (active) {
      const row = await api.updateSnippet(active, { title, language, code });
      loadSnippet(row);
    } else {
      const row = await api.createSnippet({ title, language, code });
      loadSnippet(row);
    }
    load();
  }

  async function run() {
    setRunning(true);
    setOutput('Running…');
    try {
      if (active) {
        await api.updateSnippet(active, { title, language, code });
        const result = await api.runSnippet(active);
        const text = [result.stdout, result.stderr].filter(Boolean).join('\n');
        setOutput(text || `(exit ${result.exit_code})`);
        load();
      } else {
        const result = await api.runCode({ language, code });
        const text = [result.stdout, result.stderr].filter(Boolean).join('\n');
        setOutput(text || `(exit ${result.exit_code})`);
      }
    } catch (err) {
      setOutput(String(err.message || err));
    } finally {
      setRunning(false);
    }
  }

  function fresh(lang) {
    const spec = LANGS.find((l) => l.id === lang) || LANGS[0];
    setActive(null);
    setLanguage(spec.id);
    setCode(spec.sample);
    setTitle(`${spec.label} cell`);
    setOutput('');
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
      <aside className="space-y-3">
        <h2 className="font-serif text-2xl">Code lab</h2>
        <p className="text-xs text-muted">A lighter Colab: write a cell, run it, keep the output.</p>
        <div className="flex flex-col gap-2">
          {LANGS.map((l) => (
            <button key={l.id} className="btn-secondary text-sm" onClick={() => fresh(l.id)}>
              New {l.label}
            </button>
          ))}
        </div>
        <div className="space-y-2 pt-2">
          {snippets.map((s) => (
            <button
              key={s.id}
              onClick={() => loadSnippet(s)}
              className={`w-full rounded-xl border border-line px-3 py-2 text-left text-sm ${
                active === s.id ? 'bg-elevated' : ''
              }`}
            >
              <p className="truncate">{s.title}</p>
              <p className="text-xs text-muted">{s.language}</p>
            </button>
          ))}
        </div>
      </aside>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <input className="input max-w-xs" value={title} onChange={(e) => setTitle(e.target.value)} />
          <select
            className="input w-40"
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
          >
            {LANGS.map((l) => (
              <option key={l.id} value={l.id}>
                {l.label}
              </option>
            ))}
          </select>
          <button className="btn-secondary" onClick={save}>
            Save
          </button>
          <button className="btn-primary" onClick={run} disabled={running}>
            {running ? 'Running…' : 'Run cell'}
          </button>
          {active && (
            <button
              className="text-sm text-red-500"
              onClick={async () => {
                await api.deleteSnippet(active);
                fresh('python');
                load();
              }}
            >
              Delete
            </button>
          )}
        </div>
        <textarea
          className="input min-h-[320px] resize-y font-mono text-sm"
          style={{ background: 'var(--code-bg)', color: 'var(--code-fg)' }}
          spellCheck={false}
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />
        <div className="card">
          <p className="text-xs uppercase tracking-widest text-muted">Output</p>
          <pre className="mt-2 whitespace-pre-wrap font-mono text-sm">{output || 'Run a cell to see stdout here.'}</pre>
        </div>
      </section>
    </div>
  );
}
