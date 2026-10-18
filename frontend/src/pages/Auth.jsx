import { useEffect, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.1 5.5c4.2-3.9 7.2-9.6 7.2-16.9z" />
      <path fill="#FBBC05" d="M10.5 28.7a14.5 14.5 0 0 1 0-9.4l-7.9-6.1a24 24 0 0 0 0 21.6l7.9-6.1z" />
      <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.1-5.5c-2 1.4-4.7 2.3-8.8 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z" />
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 .5a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.52-1.33-1.28-1.69-1.28-1.69-1.04-.71.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a10.9 10.9 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.83 1.19 3.09 0 4.42-2.69 5.4-5.26 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .5z" />
    </svg>
  );
}

function ProviderButton({ provider, label, icon, enabled }) {
  if (enabled === null) {
    return (
      <div className="btn-secondary flex w-full animate-pulse items-center justify-center gap-3 opacity-60" aria-hidden="true">
        {icon}
        {label}
      </div>
    );
  }
  if (!enabled) {
    return (
      <button
        type="button"
        disabled
        title={`${label} isn't configured on this server yet`}
        className="btn-secondary flex w-full cursor-not-allowed items-center justify-center gap-3 opacity-50"
      >
        {icon}
        {label}
      </button>
    );
  }
  // A full-page navigation: the server redirects to the provider and back.
  return (
    <a href={`/api/auth/${provider}/login`} className="btn-secondary flex w-full items-center justify-center gap-3">
      {icon}
      {label}
    </a>
  );
}

export default function AuthPage({ mode }) {
  const isSignup = mode === 'signup';
  const { user, login, signup } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const [providers, setProviders] = useState(null); // null while loading
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState(params.get('error') || '');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api
      .authProviders()
      .then(setProviders)
      .catch(() => setProviders({ google: false, github: false }));
  }, []);

  useEffect(() => {
    setError(params.get('error') || '');
  }, [mode, params]);

  if (user) return <Navigate to={location.state?.from || '/'} replace />;

  const update = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (isSignup && form.password.length < 8) {
      setError('Use at least 8 characters for your password.');
      return;
    }
    setBusy(true);
    try {
      if (isSignup) await signup(form.name, form.email, form.password);
      else await login(form.email, form.password);
      navigate(location.state?.from || '/', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const tab = (to, label, active) => (
    <Link
      to={to}
      state={location.state}
      className={`flex-1 rounded-lg px-4 py-2 text-center text-sm font-medium transition ${
        active ? 'bg-brand-500 text-white' : 'text-muted hover:bg-hover'
      }`}
    >
      {label}
    </Link>
  );

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas p-6 text-ink">
      <div className="w-full max-w-md space-y-6">
        <div className="flex items-center justify-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-500 text-sm font-bold text-white">FS</div>
          <div>
            <h1 className="font-serif text-2xl tracking-tight">FocusStack</h1>
            <p className="text-xs text-muted">Writing studio</p>
          </div>
        </div>

        <div className="card space-y-5">
          <div className="flex gap-1 rounded-xl bg-elevated p-1">
            {tab('/login', 'Log in', !isSignup)}
            {tab('/signup', 'Sign up', isSignup)}
          </div>

          <div className="space-y-3">
            <ProviderButton provider="google" label="Continue with Google" icon={<GoogleIcon />} enabled={providers ? providers.google : null} />
            <ProviderButton provider="github" label="Continue with GitHub" icon={<GitHubIcon />} enabled={providers ? providers.github : null} />
          </div>

          <div className="flex items-center gap-3 text-xs uppercase tracking-widest text-muted">
            <span className="h-px flex-1 bg-line" />
            or with email
            <span className="h-px flex-1 bg-line" />
          </div>

          <form onSubmit={submit} className="space-y-3" noValidate>
            {isSignup && (
              <input className="input" placeholder="Your name" autoComplete="name" value={form.name} onChange={update('name')} />
            )}
            <input className="input" type="email" placeholder="Email" autoComplete="email" required value={form.email} onChange={update('email')} />
            <input
              className="input"
              type="password"
              placeholder={isSignup ? 'Password (8+ characters)' : 'Password'}
              autoComplete={isSignup ? 'new-password' : 'current-password'}
              required
              value={form.password}
              onChange={update('password')}
            />
            {error && (
              <p role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-500">{error}</p>
            )}
            <button className="btn-primary w-full disabled:opacity-60" disabled={busy}>
              {busy ? 'One moment…' : isSignup ? 'Create account' : 'Log in'}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-muted">
          {isSignup ? 'Already have an account?' : 'New here?'}{' '}
          <Link className="text-brand-500 hover:underline" to={isSignup ? '/login' : '/signup'} state={location.state}>
            {isSignup ? 'Log in' : 'Create an account'}
          </Link>
          {' · '}
          <Link className="text-brand-500 hover:underline" to="/playlist">Just listen</Link>
        </p>
      </div>
    </div>
  );
}
