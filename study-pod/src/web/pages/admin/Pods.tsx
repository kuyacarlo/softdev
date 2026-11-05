import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router';
import { ApiError, api, type Pod, type PodStatus } from '../../api';
import { Alert, ErrorAlert, Field, Modal } from '../../components/ui';
import { useIsManager } from './AdminLayout';

type Affected = { code: string; date: string; startTime: string; status: string; student: string }[];

export function AdminPods() {
  const isManager = useIsManager();
  const [pods, setPods] = useState<Pod[]>([]);
  const [error, setError] = useState<unknown>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [editing, setEditing] = useState<Pod | 'new' | null>(null);
  const [statusChange, setStatusChange] = useState<{ pod: Pod; status: PodStatus; affected?: Affected; message?: string } | null>(null);

  const load = useCallback(async () => {
    try {
      setPods((await api.get<{ pods: Pod[] }>('/api/admin/pods')).pods);
    } catch (e) {
      setError(e);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  async function changeStatus(pod: Pod, status: PodStatus, cancelReservations: 'none' | 'window' | 'all' = 'none', reason = '') {
    setError(null);
    try {
      const r = await api.post<{ cancelledReservations: string[]; remainingReservations: number }>(`/api/admin/pods/${pod.id}/status`, {
        status,
        cancelReservations,
        reason: reason || undefined,
      });
      setStatusChange(null);
      setMessage(
        `${pod.name} is now ${status}.` +
          (r.cancelledReservations.length ? ` Cancelled ${r.cancelledReservations.length} reservation(s).` : '') +
          (r.remainingReservations && status !== 'active' ? ` ${r.remainingReservations} existing reservation(s) were kept.` : ''),
      );
      load();
    } catch (e) {
      if (e instanceof ApiError && e.code === 'RETIRE_CONFLICT') {
        setStatusChange({ pod, status, affected: e.details.affected, message: e.message });
      } else setError(e);
    }
  }

  return (
    <div className="stack">
      <div className="row spread">
        <p className="muted" style={{ margin: 0 }}>
          Changes apply to student availability immediately. Pods under maintenance or retired accept no new bookings.
        </p>
        {isManager && <button onClick={() => setEditing('new')}>+ Add pod</button>}
      </div>
      {message && <Alert kind="ok"><p>{message}</p></Alert>}
      <ErrorAlert error={error} />
      <div className="card table-wrap">
        <table>
          <thead>
            <tr>
              <th>Label</th>
              <th>Name</th>
              <th>Location</th>
              <th>Capacity</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {pods.map((p) => (
              <tr key={p.id}>
                <td className="mono">{p.label}</td>
                <td>
                  {p.name}
                  {p.amenities.length > 0 && <div className="muted small">{p.amenities.join(', ')}</div>}
                </td>
                <td>
                  {p.building}, F{p.floor}
                </td>
                <td>{p.capacity}</td>
                <td>
                  <span className={`badge ${p.status}`}>{p.status}</span>
                </td>
                <td>
                  <div className="row">
                    {isManager && p.status !== 'retired' && (
                      <button className="secondary small" onClick={() => setEditing(p)}>
                        Edit
                      </button>
                    )}
                    {p.status === 'active' && (
                      <button className="secondary small" onClick={() => changeStatus(p, 'maintenance')}>
                        Maintenance
                      </button>
                    )}
                    {p.status === 'maintenance' && (
                      <button className="secondary small" onClick={() => changeStatus(p, 'active')}>
                        Reactivate
                      </button>
                    )}
                    {isManager && p.status !== 'retired' && (
                      <button className="secondary small" onClick={() => setStatusChange({ pod: p, status: 'retired' })}>
                        Retire
                      </button>
                    )}
                    {isManager && p.status === 'retired' && (
                      <button className="secondary small" onClick={() => changeStatus(p, 'active')}>
                        Restore
                      </button>
                    )}
                    {p.status !== 'retired' && (
                      <Link className="btn secondary small" to={`/admin/pods/${p.id}/label`}>
                        QR label
                      </Link>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={!!editing} onClose={() => setEditing(null)}>
        {editing && (
          <PodForm
            pod={editing === 'new' ? null : editing}
            onDone={(msg) => {
              setEditing(null);
              if (msg) setMessage(msg);
              load();
            }}
          />
        )}
      </Modal>
      <Modal open={!!statusChange} onClose={() => setStatusChange(null)}>
        {statusChange && <RetireDialog change={statusChange} onConfirm={changeStatus} onClose={() => setStatusChange(null)} />}
      </Modal>
    </div>
  );
}

function RetireDialog({
  change,
  onConfirm,
  onClose,
}: {
  change: { pod: Pod; status: PodStatus; affected?: Affected; message?: string };
  onConfirm: (pod: Pod, status: PodStatus, mode: 'none' | 'window' | 'all', reason: string) => void;
  onClose: () => void;
}) {
  const [reason, setReason] = useState('');
  const [cancelAll, setCancelAll] = useState(false);
  return (
    <div className="stack">
      <h2>Retire {change.pod.name}?</h2>
      <p className="muted">Retired pods disappear from the student catalog and accept no new bookings.</p>
      {change.affected && (
        <>
          <Alert kind="warn">
            <p>{change.message}</p>
          </Alert>
          <ul>
            {change.affected.map((a) => (
              <li key={a.code}>
                <span className="mono">{a.code}</span> — {a.student}, {a.date} {a.startTime}
              </li>
            ))}
          </ul>
        </>
      )}
      <label className="row small">
        <input type="checkbox" style={{ width: 'auto' }} checked={cancelAll} onChange={(e) => setCancelAll(e.target.checked)} />
        Also cancel all later reservations for this pod
      </label>
      <Field label="Reason (emailed to affected students)">
        <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Pod is being removed for renovation" />
      </Field>
      <div className="row">
        <button className="danger" onClick={() => onConfirm(change.pod, 'retired', cancelAll ? 'all' : change.affected ? 'window' : 'none', reason)}>
          {change.affected ? 'Cancel these bookings and retire' : 'Retire pod'}
        </button>
        <button className="secondary" onClick={onClose}>
          Back
        </button>
      </div>
    </div>
  );
}

function PodForm({ pod, onDone }: { pod: Pod | null; onDone: (msg?: string) => void }) {
  const [form, setForm] = useState({
    label: pod?.label ?? '',
    name: pod?.name ?? '',
    building: pod?.building ?? '',
    floor: pod?.floor ?? 1,
    capacity: pod?.capacity ?? 1,
    amenities: pod?.amenities.join(', ') ?? '',
    notes: pod?.notes ?? '',
  });
  const [error, setError] = useState<unknown>(null);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [k]: e.target.type === 'number' ? Number(e.target.value) : e.target.value });

  return (
    <form
      className="stack"
      onSubmit={async (e) => {
        e.preventDefault();
        const body = {
          ...form,
          amenities: form.amenities
            .split(',')
            .map((a) => a.trim())
            .filter(Boolean),
          notes: form.notes || null,
        };
        try {
          if (pod) await api.patch(`/api/admin/pods/${pod.id}`, body);
          else await api.post('/api/admin/pods', body);
          onDone(pod ? `${form.name} updated.` : `${form.name} added and open for booking.`);
        } catch (err) {
          setError(err);
        }
      }}
    >
      <h2>{pod ? `Edit ${pod.label}` : 'Add a pod'}</h2>
      <ErrorAlert error={error} />
      <div className="filters">
        <Field label="Label (unique)">
          <input required value={form.label} onChange={set('label')} placeholder="MAIN-2-A4" />
        </Field>
        <Field label="Name">
          <input required value={form.name} onChange={set('name')} placeholder="Quiet Pod A4" />
        </Field>
        <Field label="Building">
          <input required value={form.building} onChange={set('building')} />
        </Field>
        <Field label="Floor">
          <input type="number" required value={form.floor} onChange={set('floor')} />
        </Field>
        <Field label="Capacity">
          <input type="number" min={1} max={20} required value={form.capacity} onChange={set('capacity')} />
        </Field>
      </div>
      <Field label="Amenities (comma-separated)">
        <input value={form.amenities} onChange={set('amenities')} placeholder="Whiteboard, Monitor, Power outlet" />
      </Field>
      <Field label="Internal notes">
        <textarea rows={2} value={form.notes} onChange={set('notes')} />
      </Field>
      <div className="row">
        <button>{pod ? 'Save' : 'Add pod'}</button>
        <button type="button" className="secondary" onClick={() => onDone()}>
          Cancel
        </button>
      </div>
    </form>
  );
}
