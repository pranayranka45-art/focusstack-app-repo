import { NavLink, Route, Routes } from 'react-router-dom';
import ThemeSelector from './components/ThemeSelector';
import Dashboard from './pages/Dashboard';
import Writer from './pages/Writer';
import MindMap from './pages/MindMap';
import Finances from './pages/Finances';
import Templates from './pages/Templates';
import Playlist from './pages/Playlist';
import Lab from './pages/Lab';

const navItems = [
  { to: '/', label: 'Studio', icon: '✦' },
  { to: '/write', label: 'Write', icon: '✎' },
  { to: '/maps', label: 'Mind maps', icon: '◎' },
  { to: '/finances', label: 'Finances', icon: '◈' },
  { to: '/templates', label: 'Templates', icon: '▤' },
  { to: '/playlist', label: 'Playlist', icon: '♪' },
  { to: '/lab', label: 'Code lab', icon: '⌘' },
];

export default function App() {
  return (
    <div className="flex min-h-screen bg-canvas text-ink">
      <aside className="fixed inset-y-0 left-0 z-10 flex w-64 flex-col border-r border-line bg-panel/95 backdrop-blur-xl">
        <div className="flex items-center gap-3 border-b border-line px-6 py-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500 text-sm font-bold text-white">
            FS
          </div>
          <div>
            <h1 className="font-serif text-lg tracking-tight">FocusStack</h1>
            <p className="text-xs text-muted">Writing studio</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1 p-4">
          {navItems.map(({ to, label, icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) => `nav-link ${isActive ? 'nav-link-active' : ''}`}
            >
              <span className="w-5 text-center">{icon}</span>
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="space-y-4 border-t border-line p-4">
          <ThemeSelector />
          <p className="text-xs text-muted">Quiet pages. Clear thinking.</p>
        </div>
      </aside>

      <main className="ml-64 flex-1 p-8">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/write" element={<Writer />} />
          <Route path="/write/:id" element={<Writer />} />
          <Route path="/maps" element={<MindMap />} />
          <Route path="/maps/:id" element={<MindMap />} />
          <Route path="/finances" element={<Finances />} />
          <Route path="/templates" element={<Templates />} />
          <Route path="/playlist" element={<Playlist />} />
          <Route path="/lab" element={<Lab />} />
        </Routes>
      </main>
    </div>
  );
}
