import { useEffect, useState } from 'react';
import { ApiError, api, type Pod, type Reservation } from '../api';
import { Alert, ErrorAlert, Field, Spinner } from '../components/ui';
import { useApp } from '../context';
import { clock } from '../format';

/** Shared check-in tablet near a pod cluster (SRS 3.1.2). */
export function KioskPage() {
  const { user, config } = useApp();
  const [session, setSession] = useState<{ building: string; pods: Pod[] } | null>(null);
  const [state, setState] = useState<'loading' | 'inactive' | 'ready'>('loading');
  const [pod, setPod] = useState<Pod | null>(null);
  const [pin, setPin] = useState('');
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [building, setBuilding] = useState(config.locations[0]?.building ?? '');

  async function load() {
    try {
      setSession(await api.get('/api/kiosk/session'));
      setState('ready');
    } catch {
      setState('inactive');
    }
  }
  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!result) return;
    const t = setTimeout(() => {
      setResult(null);
      setPin('');
      setPod(null);
    }, 7000);
    return () => clearTimeout(t);
  }, [result]);

  async function activate() {
    setError(null);
    try {
      await api.post('/api/kiosk/session', { building });
      await load();
    } catch (e) {
      setError(e);
    }
  }

  async function submit() {
    if (!pod) return;
    try {
      const r = await api.post<{ reservation: Reservation; alreadyCheckedIn: boolean }>('/api/kiosk/checkin', { podId: pod.id, pin });
      setResult({
        ok: true,
        text: `Welcome${r.reservation.student.name ? `, ${r.reservation.student.name}` : ''}! You're checked in to ${pod.name} until ${clock(r.reservation.endAt, config.timezone)}.`,
      });
    } catch (e) {
      setResult({ ok: false, text: e instanceof ApiError ? e.message : 'Something went wrong. Please ask the front desk.' });
    }
  }

  const press = (d: string) => setPin((p) => (p.length < 6 ? p + d : p));

  if (state === 'loading') return <main><Spinner /></main>;

  if (state === 'inactive') {
    return (
      <main className="kiosk stack">
        <h1>Check-in kiosk</h1>
        <p className="muted">This device is not activated yet. A staff member must sign in and choose the building it serves.</p>
        <ErrorAlert error={error} />
        {user?.kind === 'staff' ? (
          <div className="card stack">
            <Field label="Building">
              <select value={building} onChange={(e) => setBuilding(e.target.value)}>
                {config.locations.map((l) => (
                  <option key={l.building}>{l.building}</option>
                ))}
              </select>
            </Field>
            <button onClick={activate}>Activate kiosk</button>
          </div>
        ) : (
          <a className="btn" href="/login?returnTo=/kiosk">
            Staff sign in
          </a>
        )}
      </main>
    );
  }

  return (
    <main className="kiosk stack">
      <div>
        <h1>Study pod check-in</h1>
        <p className="muted">{session!.building}</p>
      </div>
      {result ? (
        <Alert kind={result.ok ? 'ok' : 'error'}>
          <p style={{ fontSize: '1.15rem' }}>{result.text}</p>
        </Alert>
      ) : !pod ? (
        <>
          <p>Tap your pod</p>
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))' }}>
            {session!.pods.map((p) => (
              <button key={p.id} className="secondary" style={{ padding: '1rem' }} onClick={() => setPod(p)}>
                {p.name}
                <br />
                <span className="mono small">{p.label}</span>
              </button>
            ))}
          </div>
        </>
      ) : (
        <div className="card stack">
          <div className="row spread">
            <strong>{pod.name}</strong>
            <button className="ghost" onClick={() => (setPod(null), setPin(''))}>
              Change pod
            </button>
          </div>
          <p className="muted">Enter the 6-digit PIN from your confirmation</p>
          <div className="pin-display" aria-live="polite">
            {pin.padEnd(6, '·')}
          </div>
          <div className="pinpad">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
              <button key={d} className="secondary" onClick={() => press(d)}>
                {d}
              </button>
            ))}
            <button className="secondary" onClick={() => setPin((p) => p.slice(0, -1))} aria-label="Delete">
              ⌫
            </button>
            <button className="secondary" onClick={() => press('0')}>
              0
            </button>
            <button onClick={submit} disabled={pin.length !== 6}>
              OK
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
