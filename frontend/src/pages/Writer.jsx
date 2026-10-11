import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';

const TYPES = [
  { id: 'blog', label: 'Blog ideas' },
  { id: 'essay', label: 'Personal essays' },
  { id: 'finance', label: 'Money stories' },
];

export default function Writer() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [docs, setDocs] = useState([]);
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [doc, setDoc] = useState(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [status, setStatus] = useState('');
  const [templates, setTemplates] = useState([]);
  const saveTimer = useRef(null);

  async function refresh() {
    const list = query.trim()
      ? await api.searchDocuments(query.trim())
      : await api.getDocuments();
    setDocs(list.filter((d) => d.doc_type !== 'mindmap'));
  }

  useEffect(() => {
    refresh().catch(console.error);
    api
      .getTemplates()
      .then((list) => setTemplates(list.filter((t) => t.doc_type !== 'mindmap')))
      .catch(console.error);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      refresh().catch(console.error);
    }, 250);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    if (!id) {
      setDoc(null);
      setTitle('');
      setContent('');
      return;
    }
    api.getDocument(id).then((d) => {
      setDoc(d);
      setTitle(d.title);
      setContent(d.content);
    }).catch(console.error);
  }, [id]);

  function scheduleSave(nextTitle, nextContent) {
    if (!id) return;
    setStatus('Saving…');
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        await api.updateDocument(id, { title: nextTitle, content: nextContent });
        setStatus('Saved');
        refresh();
      } catch {
        setStatus('Could not save');
      }
    }, 500);
  }

  async function create(docType) {
    const created = await api.createDocument({
      title: 'Untitled',
      content: '',
      doc_type: docType,
    });
    await refresh();
    navigate(`/write/${created.id}`);
  }

  async function startFromTemplate(tmpl) {
    const created = await api.fromTemplate(tmpl.id, tmpl.title);
    await refresh();
    navigate(`/write/${created.id}`);
  }

  async function duplicate(docId) {
    const copy = await api.duplicateDocument(docId);
    await refresh();
    navigate(`/write/${copy.id}`);
  }

  async function remove(docId) {
    await api.deleteDocument(docId);
    if (id === docId) navigate('/write');
    refresh();
  }

  const visible =
    filter === 'all' ? docs : docs.filter((d) => d.doc_type === filter);

  const words = content.trim() ? content.trim().split(/\s+/).length : 0;

  return (
    <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
      <aside className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-serif text-2xl">Write</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn-primary text-sm" onClick={() => create('blog')}>
            New blog
          </button>
          <button className="btn-secondary text-sm" onClick={() => create('essay')}>
            New essay
          </button>
        </div>
        {templates.length > 0 && (
          <div>
            <p className="mb-1 text-xs uppercase tracking-widest text-muted">Start from a template</p>
            <div className="space-y-1">
              {templates.map((t) => (
                <button
                  key={t.id}
                  onClick={() => startFromTemplate(t)}
                  className="w-full rounded-lg border border-line px-3 py-1.5 text-left text-sm hover:bg-hover"
                  title={t.blurb}
                >
                  {t.title}
                </button>
              ))}
            </div>
          </div>
        )}
        <input
          className="input text-sm"
          placeholder="Search pages…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="flex flex-wrap gap-1">
          {[{ id: 'all', label: 'All' }, ...TYPES].map((t) => (
            <button
              key={t.id}
              onClick={() => setFilter(t.id)}
              className={`rounded-lg px-2 py-1 text-xs ${filter === t.id ? 'bg-brand-500/15 text-brand-600' : 'text-muted'}`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="space-y-2">
          {visible.map((d) => (
            <button
              key={d.id}
              onClick={() => navigate(`/write/${d.id}`)}
              className={`w-full rounded-xl border border-line px-3 py-2 text-left text-sm ${
                id === d.id ? 'bg-elevated' : 'hover:bg-hover'
              }`}
            >
              <p className="truncate font-medium">{d.title}</p>
              <p className="text-xs text-muted">{d.doc_type}</p>
            </button>
          ))}
          {visible.length === 0 && (
            <p className="text-sm text-muted">No pages yet. Start from a template or a blank file.</p>
          )}
        </div>
      </aside>

      <section className="card min-h-[70vh]">
        {!doc ? (
          <div className="flex h-full min-h-[50vh] flex-col items-center justify-center text-center">
            <p className="font-serif text-2xl">Pick a page, or begin.</p>
            <p className="mt-2 max-w-md text-sm text-muted">
              Blog sparks, personal essays, and money stories live here. Mind maps have their own canvas.
            </p>
            {templates.length > 0 && (
              <div className="mt-6 grid w-full max-w-xl gap-3 text-left sm:grid-cols-2">
                {templates.slice(0, 4).map((t) => (
                  <button
                    key={t.id}
                    onClick={() => startFromTemplate(t)}
                    className="rounded-xl border border-line p-4 hover:bg-hover"
                  >
                    <p className="font-serif text-lg">{t.title}</p>
                    <p className="mt-1 text-xs text-muted">{t.blurb}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="flex h-full flex-col gap-4">
            <div className="flex items-center justify-between gap-4">
              <input
                className="input font-serif text-2xl"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  scheduleSave(e.target.value, content);
                }}
              />
              <div className="flex items-center gap-3 text-xs text-muted">
                <span>{words} words</span>
                <span>{status}</span>
                <button onClick={() => duplicate(doc.id)}>Duplicate</button>
                <a className="hover:underline" href={api.exportDocument(doc.id)}>
                  Export
                </a>
                <button className="text-red-500" onClick={() => remove(doc.id)}>
                  Delete
                </button>
              </div>
            </div>
            <textarea
              className="input min-h-[60vh] resize-none font-serif text-lg leading-relaxed"
              placeholder="Start in the middle. You can always tidy the opening later."
              value={content}
              onChange={(e) => {
                setContent(e.target.value);
                scheduleSave(title, e.target.value);
              }}
            />
          </div>
        )}
      </section>
    </div>
  );
}
