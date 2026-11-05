import { useCallback, useEffect, useState } from 'react';
import { api, qs } from '../../api';
import { ErrorAlert, Field, Spinner } from '../../components/ui';
import { useApp } from '../../context';
import { formatDate, pct } from '../../format';

interface Metrics {
  reservations: number;
  checkedIn: number;
  noShows: number;
  cancelled: number;
  usedMinutes: number;
  bookedMinutes: number;
  capacityMinutes: number;
  noShowRate: number;
  cancellationRate: number;
  occupancyRate: number;
  bookingRate: number;
}
interface Report {
  range: { from: string; to: string; days: number };
  pods: number;
  totals: Metrics;
  peakHour: { hour: number; reservations: number } | null;
  hourly: { hour: number; reservations: number }[];
  byBuilding: (Metrics & { building: string })[];
  daily: (Metrics & { date: string })[];
}

function addDays(date: string, n: number) {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

export function AdminReports() {
  const { config } = useApp();
  const [from, setFrom] = useState(addDays(config.today, -6));
  const [to, setTo] = useState(config.today);
  const [building, setBuilding] = useState('');
  const [floor, setFloor] = useState('');
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState<unknown>(null);
  const floors = config.locations.find((l) => l.building === building)?.floors ?? [];
  const query = qs({ from, to, building, floor });

  const load = useCallback(async () => {
    setError(null);
    try {
      setReport(await api.get<Report>(`/api/admin/reports${query}`));
    } catch (e) {
      setError(e);
    }
  }, [query]);
  useEffect(() => {
    load();
  }, [load]);

  const max = Math.max(1, ...(report?.hourly.map((h) => h.reservations) ?? [1]));

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
            <select value={building} onChange={(e) => (setBuilding(e.target.value), setFloor(''))}>
              <option value="">All buildings</option>
              {config.locations.map((l) => (
                <option key={l.building}>{l.building}</option>
              ))}
            </select>
          </Field>
          <Field label="Floor">
            <select value={floor} onChange={(e) => setFloor(e.target.value)} disabled={!building}>
              <option value="">All floors</option>
              {floors.map((f) => (
                <option key={f} value={f}>
                  Floor {f}
                </option>
              ))}
            </select>
          </Field>
          <a className="btn secondary" href={`/api/admin/reports/export.csv${query}`}>
            Export CSV
          </a>
        </div>
      </div>
      <ErrorAlert error={error} />
      {!report && !error && <Spinner />}
      {report && (
        <>
          <div className="kpis">
            <Kpi label="Occupancy rate" value={pct(report.totals.occupancyRate)} hint="Pod-minutes used ÷ open" />
            <Kpi label="Booking rate" value={pct(report.totals.bookingRate)} hint="Pod-minutes reserved ÷ open" />
            <Kpi label="No-show rate" value={pct(report.totals.noShowRate)} hint={`${report.totals.noShows} no-shows`} />
            <Kpi label="Reservations" value={String(report.totals.reservations)} hint={`${report.totals.cancelled} cancelled`} />
            <Kpi
              label="Peak hour"
              value={report.peakHour ? `${String(report.peakHour.hour).padStart(2, '0')}:00` : '—'}
              hint={report.peakHour ? `${report.peakHour.reservations} reservations` : 'No data'}
            />
          </div>

          <div className="card">
            <h2>Demand by hour of day</h2>
            <div className="bars" aria-label="Reservations by hour">
              {report.hourly.map((h) => (
                <div
                  key={h.hour}
                  className={report.peakHour?.hour === h.hour ? 'peak' : ''}
                  style={{ height: `${(h.reservations / max) * 100}%` }}
                  title={`${h.hour}:00 — ${h.reservations} reservations`}
                />
              ))}
            </div>
            <div className="bar-labels">
              {report.hourly.map((h) => (
                <span key={h.hour}>{h.hour % 3 === 0 ? h.hour : ''}</span>
              ))}
            </div>
          </div>

          <div className="grid-2">
            <div className="card table-wrap">
              <h2>By building</h2>
              <table>
                <thead>
                  <tr>
                    <th>Building</th>
                    <th>Bookings</th>
                    <th>Occupancy</th>
                    <th>No-show</th>
                  </tr>
                </thead>
                <tbody>
                  {report.byBuilding.map((b) => (
                    <tr key={b.building}>
                      <td>{b.building}</td>
                      <td>{b.reservations}</td>
                      <td>{pct(b.occupancyRate)}</td>
                      <td>{pct(b.noShowRate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="card table-wrap">
              <h2>By day</h2>
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Bookings</th>
                    <th>Occupancy</th>
                    <th>No-shows</th>
                  </tr>
                </thead>
                <tbody>
                  {report.daily.map((d) => (
                    <tr key={d.date}>
                      <td>{formatDate(d.date)}</td>
                      <td>{d.reservations}</td>
                      <td>{d.capacityMinutes ? pct(d.occupancyRate) : 'Closed'}</td>
                      <td>{d.noShows}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <p className="muted small">
            {report.pods} pods in scope over {report.range.days} day(s). Occupancy counts minutes from check-in start to end
            (or early check-out) against each pod's operating hours.
          </p>
        </>
      )}
    </div>
  );
}

function Kpi({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="kpi">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      <div className="muted small">{hint}</div>
    </div>
  );
}
