import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';

const ROUTES = {
  blog: '/write',
  essay: '/write',
  finance: '/write',
  mindmap: '/maps',
};

export default function Templates() {
  const [templates, setTemplates] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    api.getTemplates().then(setTemplates).catch(console.error);
  }, []);

  async function useTemplate(tmpl) {
    const doc = await api.fromTemplate(tmpl.id, tmpl.title);
    const base = ROUTES[tmpl.doc_type] || '/write';
    navigate(`${base}/${doc.id}`);
  }

  return (
    <div className="space-y-8">
      <header>
        <h2 className="font-serif text-3xl">Templates</h2>
        <p className="mt-1 text-muted">
          Steal a structure. Fill the blanks. The interesting part is never the heading.
        </p>
      </header>
      <div className="grid gap-4 md:grid-cols-2">
        {templates.map((t) => (
          <article key={t.id} className="card flex flex-col justify-between">
            <div>
              <p className="text-xs uppercase tracking-widest text-muted">{t.doc_type}</p>
              <h3 className="mt-1 font-serif text-2xl">{t.title}</h3>
              <p className="mt-2 text-sm text-muted">{t.blurb}</p>
            </div>
            <button className="btn-primary mt-6 self-start" onClick={() => useTemplate(t)}>
              Start writing
            </button>
          </article>
        ))}
      </div>
    </div>
  );
}
