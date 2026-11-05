import { useCallback, useEffect, useState } from 'react';
import { api, qs, type Pod, type Reservation, type ReservationStatus } from '../../api';
import { Alert, ErrorAlert, Field, Modal, StatusBadge } from '../../components/ui';
import { useApp } from '../../context';
import { STATUS_LABEL, clock, formatDate, formatDuration } from '../../format';

export function AdminReservations() {
  const { config } = useApp();
  const [from, setFrom] = useState(config.today);
  const [to, setTo] = useState(config.today);
  const [building, setBuilding] = useState('');
  const [status, setStatus] = useState<ReservationStatus | ''>('');
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<Reservation[]>([]);
  const [error, setError] = useState<unknown>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState<Reservation | null>(null);
  const [walkIn, setWalkIn] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await api.get<{ reservations: Reservation[] }>(`/api/admin/reservations${qs({ from, to, building, status, q })}`);
      setRows(r.reservations);
      setError(null);
    } catch (e) {
      setError(e);
    }
  }, [from, to, building, status, q]);

  useEffect(() => {
    load();
  }, [load]);

  async function checkIn(r: Reservation) {
    try {
      await api.post(`/api/admin/reservations/${r.code}/check-in`);
      setMessage(`${r.student.name} checked in to ${r.pod.name}.`);
      load();
    } catch (e) {
      setError(e);
    }
  }

  const tz = config.timezone;
  return (
    <div className="stack">
      <div className="card">
        <div className="filters">
          <Field label="From">
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </Field>
          <Field label="To">
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </Field>
          <Field label="Building">
            <select value={building} onChange={(e) => setBuilding(e.target.value)}>
              <option value="">All</option>
              {config.locations.map((l) => (
                <option key={l.building}>{l.building}</option>
              ))}
            </select>
          </Field>
          <Field label="Status">
            <select value={status} onChange={(e) => setStatus(e.target.value as ReservationStatus | '')}>
              <option value="">Any</option>
              {Object.entries(STATUS_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Search">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Code, email, name, pod" />
          </Field>
          <button onClick={() => setWalkIn(true)}>+ Walk-in</button>
        </div>
      </div>
      {message && <Alert kind="ok"><p>{message}</p></Alert>}
      <ErrorAlert error={error} />
      <div className="card table-wrap">
        <table>
          <thead>
            <tr>
              <th>Code</th>
              <th>When</th>
              <th>Pod</th>
              <th>Student</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.code}>
                <td className="mono">{r.code}</td>
                <td>
                  {formatDate(r.date, config.today)}
                  <div className="muted small">
                    {r.startTime}–{r.endTime} · {formatDuration(r.durationMinutes)}
                  </div>
                </td>
                <td>
                  {r.pod.name}
                  <div className="muted small">
                    {r.pod.building} F{r.pod.floor}
                  </div>
                </td>
                <td>
                  {r.student.name}
                  <div className="muted small">{r.student.email}</div>
                </td>
                <td>
                  <StatusBadge status={r.status} />
                  {r.source === 'walk_in' && <div className="muted small">walk-in</div>}
                  {r.checkedInAt && <div className="muted small">in at {clock(r.checkedInAt, tz)} ({r.checkInMethod})</div>}
                  {r.cancelReason && <div className="muted small">{r.cancelReason}</div>}
                </td>
                <td>
                  <div className="row">
                    {r.actions.canCheckIn && (
                      <button className="secondary small" onClick={() => checkIn(r)}>
                        Check in
                      </button>
                    )}
                    {(r.status === 'Confirmed' || r.status === 'CheckedIn') && (
                      <button className="secondary small" onClick={() => setCancelling(r)}>
                        Force cancel
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <div className="empty">No reservations match.</div>}
      </div>

      <Modal open={!!cancelling} onClose={() => setCancelling(null)}>
        {cancelling && (
          <CancelForm
            r={cancelling}
            onDone={(msg) => {
              setCancelling(null);
              if (msg) setMessage(msg);
              load();
            }}
          />
        )}
      </Modal>
      <Modal open={walkIn} onClose={() => setWalkIn(false)}>
        {walkIn && (
          <WalkInForm
            onDone={(msg) => {
              setWalkIn(false);
              if (msg) setMessage(msg);
              load();
            }}
          />
        )}
      </Modal>
    </div>
  );
}

function CancelForm({ r, onDone }: { r: Reservation; onDone: (msg?: string) => void }) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState<unknown>(null);
  return (
    <div className="stack">
      <h2>Force-cancel {r.code}</h2>
      <p className="muted">
        {r.student.name} · {r.pod.name} · {r.date} {r.startTime}–{r.endTime}. The student will be emailed.
      </p>
      <ErrorAlert error={error} />
      <Field label="Reason (shared with the student)">
        <textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Pod needed for exam proctoring" />
      </Field>
      <div className="row">
        <button
          className="danger"
          onClick={async () => {
            try {
              await api.post(`/api/admin/reservations/${r.code}/cancel`, { reason });
              onDone(`Reservation ${r.code} cancelled.`);
            } catch (e) {
              setError(e);
            }
          }}
        >
          Cancel reservation
        </button>
        <button className="secondary" onClick={() => onDone()}>
          Back
        </button>
      </div>
    </div>
  );
}

function WalkInForm({ onDone }: { onDone: (msg?: string) => void }) {
  const { config } = useApp();
  const [pods, setPods] = useState<Pod[]>([]);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [podId, setPodId] = useState<number>(0);
  const [duration, setDuration] = useState(60);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    api.get<{ pods: Pod[] }>('/api/admin/pods').then((r) => {
      const active = r.pods.filter((p) => p.status === 'active');
      setPods(active);
      setPodId(active[0]?.id ?? 0);
    });
  }, []);

  const durations: number[] = [];
  for (let d = config.policy.minDurationMinutes; d <= config.policy.maxDurationMinutes; d += 15) durations.push(d);

  return (
    <form
      className="stack"
      onSubmit={async (e) => {
        e.preventDefault();
        try {
          const r = await api.post<{ reservation: Reservation }>('/api/admin/walk-ins', {
            studentEmail: email,
            studentName: name || undefined,
            podId,
            durationMinutes: duration,
          });
          onDone(`Walk-in ${r.reservation.code}: ${r.reservation.student.name} checked in to ${r.reservation.pod.name} until ${r.reservation.endTime}.`);
        } catch (err) {
          setError(err);
        }
      }}
    >
      <h2>Walk-in override</h2>
      <p className="muted small">Books the current slot and checks the student in immediately.</p>
      <ErrorAlert error={error} />
      <Field label="Student university email">
        <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </Field>
      <Field label="Full name (needed for first-time users)">
        <input value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <div className="filters">
        <Field label="Pod">
          <select value={podId} onChange={(e) => setPodId(Number(e.target.value))}>
            {pods.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.building} F{p.floor})
              </option>
            ))}
          </select>
        </Field>
        <Field label="Duration">
          <select value={duration} onChange={(e) => setDuration(Number(e.target.value))}>
            {durations.map((d) => (
              <option key={d} value={d}>
                {formatDuration(d)}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <div className="row">
        <button>Start walk-in</button>
        <button type="button" className="secondary" onClick={() => onDone()}>
          Back
        </button>
      </div>
    </form>
  );
}
