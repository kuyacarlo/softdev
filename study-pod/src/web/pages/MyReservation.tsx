import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { api, type Reservation } from '../api';
import { QrCode } from '../components/QrCode';
import { Alert, ErrorAlert, Field, Modal, Spinner, StatusBadge } from '../components/ui';
import { useApp } from '../context';
import { clock, durationsFor, formatDate, formatDuration, startTimesFor } from '../format';

export function MyReservation() {
  const { config } = useApp();
  const [params] = useSearchParams();
  const justBooked = params.get('new');
  const [data, setData] = useState<{ active: Reservation | null; history: Reservation[] } | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  const load = useCallback(async () => {
    try {
      setData(await api.get('/api/reservations/mine'));
    } catch (e) {
      setError(e);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 30_000); // keep check-in window / no-show status fresh
    return () => clearInterval(t);
  }, [load]);

  async function act(path: string, done: string) {
    setError(null);
    try {
      await api.post(path);
      setMessage(done);
      await load();
    } catch (e) {
      setError(e);
      await load();
    }
  }

  if (!data) return error ? <ErrorAlert error={error} /> : <Spinner />;
  const r = data.active;
  const tz = config.timezone;

  return (
    <div className="stack">
      <h1>My reservation</h1>
      {justBooked && r?.code === justBooked && (
        <Alert kind="ok">
          <p>Booked! A confirmation email with your code and PIN is on its way.</p>
        </Alert>
      )}
      {message && <Alert kind="ok"><p>{message}</p></Alert>}
      <ErrorAlert error={error} />

      {r ? (
        <div className="card ticket">
          <div className="stack">
            <div className="row">
              <StatusBadge status={r.status} />
              {r.source === 'walk_in' && <span className="badge">Walk-in</span>}
            </div>
            <div>
              <h2 style={{ marginBottom: 0 }}>{r.pod.name}</h2>
              <div className="muted">
                {r.pod.building} · Floor {r.pod.floor} · <span className="mono">{r.pod.label}</span>
              </div>
            </div>
            <dl className="meta">
              <dt>When</dt>
              <dd>
                {formatDate(r.date, config.today)}, {r.startTime}–{r.endTime} ({formatDuration(r.durationMinutes)})
              </dd>
              <dt>Reservation code</dt>
              <dd className="mono big-code">{r.code}</dd>
              {r.checkInCode && (
                <>
                  <dt>Kiosk PIN</dt>
                  <dd className="mono big-code">{r.checkInCode}</dd>
                </>
              )}
              {r.status === 'Confirmed' && (
                <>
                  <dt>Check-in window</dt>
                  <dd>
                    {clock(r.checkInOpensAt, tz)}–{clock(r.checkInDeadlineAt, tz)}
                  </dd>
                </>
              )}
              {r.checkedInAt && (
                <>
                  <dt>Checked in</dt>
                  <dd>{clock(r.checkedInAt, tz)}</dd>
                </>
              )}
            </dl>
            {r.status === 'Confirmed' && (
              <p className="muted small">
                At the pod, scan its QR sticker with your phone, enter your PIN at the kiosk, or tap “Check in now”.
                If you don't check in by {clock(r.checkInDeadlineAt, tz)}, the pod is released automatically.
              </p>
            )}
            <div className="row">
              {r.actions.canCheckIn && (
                <Link className="btn" to={`/checkin?code=${r.code}`}>
                  Check in now
                </Link>
              )}
              {r.actions.canModify && (
                <button className="secondary" onClick={() => setEditing(true)}>
                  Change time
                </button>
              )}
              {r.actions.canCancel && (
                <button
                  className="secondary"
                  onClick={() => confirm('Cancel this reservation? The pod will be released for others.') && act(`/api/reservations/${r.code}/cancel`, 'Reservation cancelled.')}
                >
                  Cancel reservation
                </button>
              )}
              {r.actions.canEndEarly && (
                <button className="secondary" onClick={() => act(`/api/reservations/${r.code}/end`, 'Session ended — thanks for freeing the pod!')}>
                  End session early
                </button>
              )}
            </div>
            {r.status === 'Confirmed' && !r.actions.canModify && (
              <p className="muted small">
                Changes close {config.policy.modifyCutoffMinutes} minutes before the start. You can still cancel and rebook.
              </p>
            )}
          </div>
          {r.status === 'Confirmed' && (
            <div className="stack" style={{ justifyItems: 'center' }}>
              <QrCode value={`${location.origin}/checkin?code=${r.code}`} label={`Check-in QR code for ${r.code}`} />
              <span className="muted small">QR check-in code</span>
            </div>
          )}
        </div>
      ) : (
        <div className="card empty">
          <p>You don't have an active reservation.</p>
          <Link className="btn" to="/">
            Find a pod
          </Link>
        </div>
      )}

      {data.history.length > 0 && (
        <div className="card">
          <h2>History</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Time</th>
                  <th>Pod</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {data.history.map((h) => (
                  <tr key={h.code}>
                    <td>{formatDate(h.date)}</td>
                    <td>
                      {h.startTime}–{h.endTime}
                    </td>
                    <td>{h.pod.name}</td>
                    <td>
                      <StatusBadge status={h.status} />
                      {h.cancelReason && h.cancelledBy === 'staff' && <div className="muted small">{h.cancelReason}</div>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {r && (
        <Modal open={editing} onClose={() => setEditing(false)}>
          <EditReservation
            reservation={r}
            onDone={async (msg) => {
              setEditing(false);
              if (msg) setMessage(msg);
              await load();
            }}
          />
        </Modal>
      )}
    </div>
  );
}

function EditReservation({ reservation, onDone }: { reservation: Reservation; onDone: (msg?: string) => void }) {
  const { config } = useApp();
  const [date, setDate] = useState(reservation.date);
  const starts = startTimesFor(config, date, config.policy.minDurationMinutes);
  const [start, setStart] = useState(reservation.startTime);
  const effectiveStart = starts.includes(start) ? start : starts[0] ?? '';
  const durations = effectiveStart ? durationsFor(config, date, effectiveStart) : [];
  const [duration, setDuration] = useState(reservation.durationMinutes);
  const effectiveDuration = durations.includes(duration) ? duration : durations[0];
  const [error, setError] = useState<unknown>(null);

  async function save() {
    setError(null);
    try {
      await api.patch(`/api/reservations/${reservation.code}`, {
        date,
        startTime: effectiveStart,
        durationMinutes: effectiveDuration,
      });
      onDone('Reservation updated.');
    } catch (e) {
      setError(e);
    }
  }

  return (
    <div className="stack">
      <h2>Change time</h2>
      <p className="muted small">
        Same pod ({reservation.pod.name}). If it's taken at the new time, your current booking stays as it is.
      </p>
      <ErrorAlert error={error} />
      <div className="filters">
        <Field label="Date">
          <select value={date} onChange={(e) => setDate(e.target.value)}>
            {config.bookableDates.map((d) => (
              <option key={d} value={d}>
                {formatDate(d, config.today)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Start">
          <select value={effectiveStart} onChange={(e) => setStart(e.target.value)}>
            {starts.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </Field>
        <Field label="Duration">
          <select value={effectiveDuration} onChange={(e) => setDuration(Number(e.target.value))}>
            {durations.map((d) => (
              <option key={d} value={d}>
                {formatDuration(d)}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <div className="row">
        <button onClick={save} disabled={!effectiveStart}>
          Save changes
        </button>
        <button className="secondary" onClick={() => onDone()}>
          Keep current time
        </button>
      </div>
    </div>
  );
}
