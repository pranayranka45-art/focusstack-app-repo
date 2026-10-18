import { Link, Navigate, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import ThemeSelector from './components/ThemeSelector';
import { useAuth } from './context/AuthContext';
import AuthPage from './pages/Auth';
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

function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <p className="text-muted">Loading…</p>;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return children;
}

function AccountBox() {
  const { user, logout } = useAuth();
  if (!user) {
    return (
      <div className="flex gap-2">
        <Link to="/login" className="btn-primary flex-1 px-3 py-2 text-center text-sm">Log in</Link>
        <Link to="/signup" className="btn-secondary flex-1 px-3 py-2 text-center text-sm">Sign up</Link>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-3">
      {user.avatar_url ? (
        <img src={user.avatar_url} alt="" referrerPolicy="no-referrer" className="h-9 w-9 rounded-full object-cover" />
      ) : (
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-500 text-sm font-semibold text-white">
          {user.name.slice(0, 1).toUpperCase()}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{user.name}</p>
        <button onClick={logout} className="text-xs text-muted hover:text-ink hover:underline">Log out</button>
      </div>
    </div>
  );
}

function Shell() {
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
          <AccountBox />
          <ThemeSelector />
          <p className="text-xs text-muted">Quiet pages. Clear thinking.</p>
        </div>
      </aside>

      <main className="ml-64 flex-1 p-8">
        <Routes>
          <Route path="/" element={<RequireAuth><Dashboard /></RequireAuth>} />
          <Route path="/write" element={<RequireAuth><Writer /></RequireAuth>} />
          <Route path="/write/:id" element={<RequireAuth><Writer /></RequireAuth>} />
          <Route path="/maps" element={<RequireAuth><MindMap /></RequireAuth>} />
          <Route path="/maps/:id" element={<RequireAuth><MindMap /></RequireAuth>} />
          <Route path="/finances" element={<RequireAuth><Finances /></RequireAuth>} />
          <Route path="/templates" element={<RequireAuth><Templates /></RequireAuth>} />
          <Route path="/playlist" element={<Playlist />} />
          <Route path="/lab" element={<RequireAuth><Lab /></RequireAuth>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<AuthPage mode="login" />} />
      <Route path="/signup" element={<AuthPage mode="signup" />} />
      <Route path="/*" element={<Shell />} />
    </Routes>
  );
}
