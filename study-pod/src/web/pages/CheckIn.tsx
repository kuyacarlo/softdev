import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { ApiError, api, qs, type Reservation } from '../api';
import { RequireUser } from '../components/Layout';
import { Alert, Spinner } from '../components/ui';
import { useApp } from '../context';
import { clock } from '../format';

/**
 * Landing page for QR check-in (SRS 3.2.4). Pod stickers link to /checkin?pod=<id>;
 * the confirmation QR links to /checkin?code=<code>.
 */
export function CheckInPage() {
  return (
    <RequireUser kind="student">
      <CheckInInner />
    </RequireUser>
  );
}

type State =
  | { kind: 'working' }
  | { kind: 'ok'; reservation: Reservation; already: boolean }
  | { kind: 'error'; error: ApiError };

function CheckInInner() {
  const { config } = useApp();
  const [params] = useSearchParams();
  const pod = params.get('pod');
  const code = params.get('code');
  const [state, setState] = useState<State>({ kind: 'working' });
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    api
      .post<{ reservation: Reservation; alreadyCheckedIn: boolean }>('/api/checkin', {
        ...(code ? { code } : {}),
        ...(pod ? { podId: Number(pod) } : {}),
      })
      .then((r) => setState({ kind: 'ok', reservation: r.reservation, already: r.alreadyCheckedIn }))
      .catch((e) => setState({ kind: 'error', error: e instanceof ApiError ? e : new ApiError(0, 'UNKNOWN', String(e)) }));
  }, [code, pod]);

  if (state.kind === 'working') return <Spinner label="Checking you in…" />;

  if (state.kind === 'ok') {
    const r = state.reservation;
    return (
      <div className="card stack" style={{ maxWidth: 520 }}>
        <Alert kind="ok">
          <p>
            <strong>{state.already ? "You're already checked in." : "You're checked in!"}</strong>
          </p>
        </Alert>
        <h2>{r.pod.name}</h2>
        <p className="muted">
          {r.pod.building}, Floor {r.pod.floor} · until {clock(r.endAt, config.timezone)}
        </p>
        <Link to="/me">View reservation</Link>
      </div>
    );
  }

  const e = state.error;
  const rebook = e.details?.rebook as { date: string; startTime: string; building: string } | undefined;
  return (
    <div className="card stack" style={{ maxWidth: 560 }}>
      <Alert kind={e.code === 'CHECK_IN_NOT_OPEN' ? 'info' : 'error'}>
        <p>{e.message}</p>
      </Alert>
      <div className="row">
        {rebook && (
          <Link className="btn" to={`/${qs({ date: rebook.date, start: rebook.startTime, building: rebook.building })}`}>
            Book again
          </Link>
        )}
        {e.code === 'NO_RESERVATION_FOR_POD' && (
          <Link className="btn" to="/">
            Find a pod
          </Link>
        )}
        <Link className="btn secondary" to="/me">
          My reservation
        </Link>
      </div>
    </div>
  );
}
