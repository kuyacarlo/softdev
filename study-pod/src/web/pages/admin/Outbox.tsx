import { Fragment, useEffect, useState } from 'react';
import { api } from '../../api';
import { ErrorAlert } from '../../components/ui';
import { useApp } from '../../context';
import { dateTime } from '../../format';

interface Notification {
  id: number;
  recipient: string;
  kind: string;
  subject: string;
  body: string;
  status: string;
  error: string | null;
  createdAt: number;
}

/** Log of every email StudyPod sent (confirmations, reminders, cancellations, no-shows). */
export function AdminOutbox() {
  const { config } = useApp();
  const [items, setItems] = useState<Notification[]>([]);
  const [open, setOpen] = useState<number | null>(null);
  const [error, setError] = useState<unknown>(null);
  useEffect(() => {
    api.get<{ notifications: Notification[] }>('/api/admin/notifications').then((r) => setItems(r.notifications)).catch(setError);
  }, []);
  return (
    <div className="stack">
      <ErrorAlert error={error} />
      <div className="card table-wrap">
        <table>
          <thead>
            <tr>
              <th>Sent</th>
              <th>To</th>
              <th>Subject</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {items.map((n) => (
              <Fragment key={n.id}>
                <tr onClick={() => setOpen(open === n.id ? null : n.id)} style={{ cursor: 'pointer' }}>
                  <td className="small">{dateTime(n.createdAt, config.timezone)}</td>
                  <td className="small">{n.recipient}</td>
                  <td>{n.subject}</td>
                  <td>
                    <span className={`badge ${n.status === 'failed' ? 'Cancelled' : 'Completed'}`}>{n.status}</span>
                  </td>
                </tr>
                {open === n.id && (
                  <tr>
                    <td colSpan={4}>
                      <pre style={{ whiteSpace: 'pre-wrap', margin: 0, fontSize: '0.85rem' }}>{n.body}</pre>
                      {n.error && <p className="small" style={{ color: 'var(--danger)' }}>{n.error}</p>}
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
        {items.length === 0 && <div className="empty">No emails yet.</div>}
      </div>
    </div>
  );
}
