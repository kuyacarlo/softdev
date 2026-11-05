import { useEffect, useState } from 'react';
import { api, type StaffRole } from '../../api';
import { ErrorAlert, Field } from '../../components/ui';
import { useApp } from '../../context';
import { dateTime } from '../../format';

interface Staff {
  id: number;
  name: string;
  email: string;
  role: StaffRole;
  active: boolean;
  lastLoginAt: number | null;
}

const ROLE_LABEL: Record<StaffRole, string> = { facility_manager: 'Facility Manager', front_desk: 'Front Desk' };

export function AdminStaff() {
  const { user, config } = useApp();
  const [staff, setStaff] = useState<Staff[]>([]);
  const [error, setError] = useState<unknown>(null);
  const [form, setForm] = useState({ name: '', email: '', role: 'front_desk' as StaffRole });

  useEffect(() => {
    api.get<{ staff: Staff[] }>('/api/admin/staff').then((r) => setStaff(r.staff)).catch(setError);
  }, []);

  async function update(id: number, body: Partial<Pick<Staff, 'role' | 'active'>>) {
    setError(null);
    try {
      setStaff((await api.patch<{ staff: Staff[] }>(`/api/admin/staff/${id}`, body)).staff);
    } catch (e) {
      setError(e);
    }
  }

  return (
    <div className="stack">
      <p className="muted">
        Staff sign in with campus SSO like everyone else; listing their university email here is what grants admin access.
      </p>
      <ErrorAlert error={error} />
      <form
        className="card filters"
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            setStaff((await api.post<{ staff: Staff[] }>('/api/admin/staff', form)).staff);
            setForm({ name: '', email: '', role: 'front_desk' });
          } catch (err) {
            setError(err);
          }
        }}
      >
        <Field label="Name">
          <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </Field>
        <Field label="Email">
          <input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </Field>
        <Field label="Role">
          <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as StaffRole })}>
            <option value="front_desk">Front Desk</option>
            <option value="facility_manager">Facility Manager</option>
          </select>
        </Field>
        <button>Add staff</button>
      </form>
      <div className="card table-wrap">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Role</th>
              <th>Last sign-in</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {staff.map((s) => {
              const self = user?.id === s.id && user.kind === 'staff';
              return (
                <tr key={s.id}>
                  <td>
                    {s.name}
                    <div className="muted small">{s.email}</div>
                  </td>
                  <td>
                    <select value={s.role} disabled={self} onChange={(e) => update(s.id, { role: e.target.value as StaffRole })} style={{ width: 'auto' }}>
                      {Object.entries(ROLE_LABEL).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="small">{s.lastLoginAt ? dateTime(s.lastLoginAt, config.timezone) : 'Never'}</td>
                  <td>
                    <button className="secondary small" disabled={self} onClick={() => update(s.id, { active: !s.active })}>
                      {s.active ? 'Deactivate' : 'Reactivate'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
