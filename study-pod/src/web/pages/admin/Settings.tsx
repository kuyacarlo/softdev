import { useEffect, useState } from 'react';
import { api, type OperatingHours, type Policy } from '../../api';
import { Alert, ErrorAlert, Field } from '../../components/ui';
import { useApp } from '../../context';
import { useIsManager } from './AdminLayout';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const POLICY_FIELDS: { key: keyof Policy; label: string; unit: string }[] = [
  { key: 'minDurationMinutes', label: 'Minimum reservation', unit: 'min' },
  { key: 'maxDurationMinutes', label: 'Maximum reservation', unit: 'min' },
  { key: 'gracePeriodMinutes', label: 'Check-in grace period', unit: 'min after start' },
  { key: 'earlyCheckInMinutes', label: 'Early check-in allowed', unit: 'min before start' },
  { key: 'modifyCutoffMinutes', label: 'Modification cutoff', unit: 'min before start' },
  { key: 'reminderLeadMinutes', label: 'Reminder email', unit: 'min before start' },
  { key: 'maxAdvanceDays', label: 'Book ahead at most', unit: 'days' },
  { key: 'retireConflictWindowHours', label: 'Retire-conflict window', unit: 'hours' },
];

/** SRS 3.5.5 — policy constants are editable without a code change. */
export function AdminSettings() {
  const { refresh } = useApp();
  const isManager = useIsManager();
  const [policy, setPolicy] = useState<Policy | null>(null);
  const [hours, setHours] = useState<OperatingHours | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.get<{ policy: Policy; operatingHours: OperatingHours }>('/api/admin/settings').then((s) => {
      setPolicy(s.policy);
      setHours(s.operatingHours);
    });
  }, []);

  if (!policy || !hours) return null;

  async function save() {
    setError(null);
    setSaved(false);
    try {
      const s = await api.put<{ policy: Policy; operatingHours: OperatingHours }>('/api/admin/settings', { policy, operatingHours: hours });
      setPolicy(s.policy);
      setHours(s.operatingHours);
      setSaved(true);
      refresh();
    } catch (e) {
      setError(e);
    }
  }

  return (
    <div className="stack">
      {!isManager && <Alert kind="info"><p>Only a Facility Manager can change these settings.</p></Alert>}
      {saved && <Alert kind="ok"><p>Settings saved — they apply to new bookings right away.</p></Alert>}
      <ErrorAlert error={error} />
      <div className="card stack">
        <h2>Reservation policy</h2>
        <div className="filters">
          {POLICY_FIELDS.map((f) => (
            <Field key={f.key} label={`${f.label} (${f.unit})`}>
              <input
                type="number"
                disabled={!isManager}
                value={policy[f.key]}
                onChange={(e) => setPolicy({ ...policy, [f.key]: Number(e.target.value) })}
              />
            </Field>
          ))}
        </div>
      </div>
      <div className="card stack">
        <h2>Operating hours</h2>
        <div className="table-wrap">
          <table>
            <tbody>
              {DAYS.map((name, i) => {
                const h = hours[String(i)];
                return (
                  <tr key={name}>
                    <td style={{ width: 130 }}>{name}</td>
                    <td style={{ width: 110 }}>
                      <label className="row small">
                        <input
                          type="checkbox"
                          style={{ width: 'auto' }}
                          disabled={!isManager}
                          checked={!!h}
                          onChange={(e) => setHours({ ...hours, [i]: e.target.checked ? { open: '08:00', close: '20:00' } : null })}
                        />
                        Open
                      </label>
                    </td>
                    <td>
                      {h ? (
                        <div className="row">
                          <input type="time" step={900} disabled={!isManager} style={{ width: 130 }} value={h.open} onChange={(e) => setHours({ ...hours, [i]: { ...h, open: e.target.value } })} />
                          –
                          <input type="time" step={900} disabled={!isManager} style={{ width: 130 }} value={h.close} onChange={(e) => setHours({ ...hours, [i]: { ...h, close: e.target.value } })} />
                        </div>
                      ) : (
                        <span className="muted">Closed</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      {isManager && (
        <div>
          <button onClick={save}>Save settings</button>
        </div>
      )}
    </div>
  );
}
