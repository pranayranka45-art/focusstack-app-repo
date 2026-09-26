import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';

function Stat({ label, value, hint }) {
  return (
    <div className="card">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-1 font-serif text-3xl">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [health, setHealth] = useState(null);

  useEffect(() => {
    api.getStats().then(setStats).catch(console.error);
    api.health().then(setHealth).catch(console.error);
  }, []);

  if (!stats) return <p className="text-muted">Opening the studio…</p>;

  return (
    <div className="space-y-8">
      <header className="max-w-2xl">
        <p className="text-sm uppercase tracking-[0.2em] text-muted">FocusStack</p>
        <h2 className="mt-2 font-serif text-4xl leading-tight">
          A desk for ideas, maps, essays, and money stories.
        </h2>
        <p className="mt-3 text-muted">
          Write without the noise. Templates when you stall. A playlist when the room is too quiet.
          A small lab when a thought needs code.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Pages" value={stats.documents_total} hint={`${stats.blogs} blog · ${stats.essays} essays`} />
        <Stat label="Words" value={stats.words_total ?? 0} hint="Across essays and posts" />
        <Stat label="Mind maps" value={stats.mindmaps} />
        <Stat label="Code snippets" value={stats.snippets} />
        <Stat
          label="Money net"
          value={`${stats.net >= 0 ? '+' : ''}${stats.net.toFixed(0)}`}
          hint={`${stats.income_total.toFixed(0)} in · ${stats.expense_total.toFixed(0)} out`}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {[
          { to: '/write', title: 'Blog & essays', copy: 'Draft posts, personal essays, and half-formed sparks.' },
          { to: '/maps', title: 'Mind maps', copy: 'Put a thought in the middle and orbit the rest around it.' },
          { to: '/finances', title: 'Personal finances', copy: 'Ledger plus a written story of the month.' },
          { to: '/templates', title: 'Templates', copy: 'Start from a structure instead of a blank page.' },
          { to: '/playlist', title: 'Writing playlist', copy: 'Lo-fi rooms, rain, café murmur — generated in the browser.' },
          { to: '/lab', title: 'Mini IDE', copy: 'Python, JavaScript, Java. Run a cell. Read the output.' },
        ].map((item) => (
          <Link key={item.to} to={item.to} className="card block transition hover:border-brand-500/40">
            <h3 className="font-serif text-xl">{item.title}</h3>
            <p className="mt-2 text-sm text-muted">{item.copy}</p>
          </Link>
        ))}
      </div>

      {health && (
        <p className="text-xs text-muted">
          Database: {health.database === 'postgresql' ? 'PostgreSQL' : 'SQLite (set POSTGRES_HOST or DATABASE_URL for Postgres)'}
          {health.dataset ? ` · ${health.dataset}` : ''}
        </p>
      )}
    </div>
  );
}
