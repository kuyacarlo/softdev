import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { api } from '../api';
import { ErrorAlert, Field } from '../components/ui';
import { useApp } from '../context';

interface DevAccounts {
  domain: string;
  staff: { name: string; email: string; role: string }[];
  students: { name: string; email: string }[];
}

export function LoginPage() {
  const { config, refresh, user } = useApp();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const returnTo = params.get('returnTo') || '/';
  const ssoError = params.get('error');

  const [accounts, setAccounts] = useState<DevAccounts | null>(null);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (config.authMode === 'dev') api.get<DevAccounts>('/api/auth/dev-accounts').then(setAccounts).catch(setError);
  }, [config.authMode]);

  useEffect(() => {
    if (user) navigate(user.kind === 'staff' && returnTo === '/' ? '/admin' : returnTo, { replace: true });
  }, [user, navigate, returnTo]);

  async function devLogin(e: string, n: string) {
    setBusy(true);
    setError(null);
    try {
      await api.post('/api/auth/dev-login', { email: e, name: n });
      await refresh();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack" style={{ maxWidth: 560, margin: '0 auto' }}>
      <div className="card stack">
        <h1>Sign in to {config.appName}</h1>
        <p className="muted">
          Use your university account. StudyPod never sees or stores your password — sign-in is handled by campus SSO.
        </p>
        {ssoError && <ErrorAlert error={ssoError} />}
        {config.authMode === 'oidc' ? (
          <a className="btn" href={`/api/auth/login?returnTo=${encodeURIComponent(returnTo)}`}>
            Sign in with campus SSO
          </a>
        ) : (
          <div className="alert warn">
            <p>
              <strong>Development mode.</strong> Campus SSO is simulated: pick a demo identity or type any
              {accounts ? ` @${accounts.domain}` : ''} email. Disable with <code>AUTH_MODE=oidc</code> in production.
            </p>
          </div>
        )}
      </div>

      {config.authMode === 'dev' && accounts && (
        <div className="card stack">
          <h2>Demo identities</h2>
          <ErrorAlert error={error} />
          <div className="stack">
            <strong className="small muted">Students</strong>
            <div className="row">
              {accounts.students.map((s) => (
                <button key={s.email} className="secondary" disabled={busy} onClick={() => devLogin(s.email, s.name)}>
                  {s.name}
                </button>
              ))}
            </div>
            <strong className="small muted">Library staff</strong>
            <div className="row">
              {accounts.staff.map((s) => (
                <button key={s.email} className="secondary" disabled={busy} onClick={() => devLogin(s.email, s.name)}>
                  {s.name} · {s.role === 'facility_manager' ? 'Facility Manager' : 'Front Desk'}
                </button>
              ))}
            </div>
          </div>
          <form
            className="filters"
            onSubmit={(e) => {
              e.preventDefault();
              devLogin(email, name);
            }}
          >
            <Field label="University email">
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder={`you@${accounts.domain}`} />
            </Field>
            <Field label="Full name">
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Juan Dela Cruz" />
            </Field>
            <button disabled={busy}>Sign in</button>
          </form>
        </div>
      )}
    </div>
  );
}
