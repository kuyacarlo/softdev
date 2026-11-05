import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { ApiError, api, qs, type Availability, type Pod, type Reservation } from '../api';
import { Timeline } from '../components/Timeline';
import { Alert, ErrorAlert, Field, Modal, Spinner } from '../components/ui';
import { useApp } from '../context';
import { durationsFor, formatDate, formatDuration, startTimesFor, toMinutes, toTime } from '../format';

export function FindPod() {
  const { config, user } = useApp();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();

  const date = params.get('date') && config.bookableDates.includes(params.get('date')!) ? params.get('date')! : config.today;
  const starts = startTimesFor(config, date, config.policy.minDurationMinutes);
  const start = params.get('start') && starts.includes(params.get('start')!) ? params.get('start')! : starts[0] ?? '';
  const durations = start ? durationsFor(config, date, start) : [];
  const wanted = Number(params.get('duration') || 60);
  const duration = durations.includes(wanted) ? wanted : durations.includes(60) ? 60 : durations[0] ?? config.policy.minDurationMinutes;
  const building = params.get('building') ?? '';
  const floor = params.get('floor') ?? '';
  const minCapacity = params.get('capacity') ?? '1';

  const floors = useMemo(() => config.locations.find((l) => l.building === building)?.floors ?? [], [config.locations, building]);

  const [result, setResult] = useState<Availability | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [selected, setSelected] = useState<Pod | null>(null);
  const [active, setActive] = useState<Reservation | null>(null);

  const set = (patch: Record<string, string>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) (v ? next.set(k, v) : next.delete(k));
    setParams(next, { replace: true });
  };

  const load = useCallback(async () => {
    if (!start) {
      setResult(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setResult(
        await api.get<Availability>(
          `/api/availability${qs({ date, startTime: start, durationMinutes: duration, building, floor, minCapacity })}`,
        ),
      );
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, [date, start, duration, building, floor, minCapacity]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (user?.kind === 'student') api.get<{ active: Reservation | null }>('/api/reservations/mine').then((r) => setActive(r.active)).catch(() => {});
  }, [user]);

  async function confirm() {
    if (!selected) return;
    try {
      const { reservation } = await api.post<{ reservation: Reservation }>('/api/reservations', {
        podId: selected.id,
        date,
        startTime: start,
        durationMinutes: duration,
      });
      navigate(`/me?new=${reservation.code}`);
    } catch (e) {
      setSelected(null);
      if (e instanceof ApiError && e.code === 'SLOT_UNAVAILABLE' && e.details?.availability) {
        setResult(e.details.availability);
        setNotice(e.message);
      } else {
        setError(e);
      }
    }
  }

  const endTime = start ? toTime(toMinutes(start) + duration) : '';
  const hours = result?.hours;

  return (
    <div className="stack">
      <div>
        <h1>Find a study pod</h1>
        <p className="muted">
          Live availability across campus libraries. Book up to {config.policy.maxAdvanceDays} days ahead, for{' '}
          {formatDuration(config.policy.minDurationMinutes)}–{formatDuration(config.policy.maxDurationMinutes)}.
        </p>
      </div>

      {active && (
        <Alert kind="info">
          <p>
            You have an active reservation: <strong>{active.pod.name}</strong>, {formatDate(active.date, config.today)} at{' '}
            {active.startTime}. <Link to="/me">View it</Link> — you can hold one reservation at a time.
          </p>
        </Alert>
      )}

      <div className="card">
        <div className="filters">
          <Field label="Date">
            <select value={date} onChange={(e) => set({ date: e.target.value, start: '' })}>
              {config.bookableDates.map((d) => (
                <option key={d} value={d}>
                  {formatDate(d, config.today)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Start">
            <select value={start} onChange={(e) => set({ start: e.target.value })} disabled={!starts.length}>
              {starts.length ? starts.map((t) => <option key={t}>{t}</option>) : <option>Closed</option>}
            </select>
          </Field>
          <Field label="Duration">
            <select value={duration} onChange={(e) => set({ duration: e.target.value })} disabled={!durations.length}>
              {durations.map((d) => (
                <option key={d} value={d}>
                  {formatDuration(d)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Building">
            <select value={building} onChange={(e) => set({ building: e.target.value, floor: '' })}>
              <option value="">Any building</option>
              {config.locations.map((l) => (
                <option key={l.building}>{l.building}</option>
              ))}
            </select>
          </Field>
          <Field label="Floor">
            <select value={floor} onChange={(e) => set({ floor: e.target.value })} disabled={!building}>
              <option value="">Any floor</option>
              {floors.map((f) => (
                <option key={f} value={f}>
                  Floor {f}
                </option>
              ))}
            </select>
          </Field>
          <Field label="People">
            <select value={minCapacity} onChange={(e) => set({ capacity: e.target.value })}>
              {[1, 2, 3, 4, 5, 6, 8].map((n) => (
                <option key={n} value={n}>
                  {n === 1 ? 'Just me' : `${n}+ people`}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </div>

      {notice && <Alert kind="warn"><p>{notice}</p></Alert>}
      <ErrorAlert error={error} />
      {!starts.length && <Alert kind="info"><p>No more bookable times on this day. Please pick another date.</p></Alert>}
      {loading && <Spinner label="Checking availability…" />}

      {result && !loading && (
        <>
          <div className="row spread">
            <h2 style={{ margin: 0 }}>
              {result.available.length
                ? `${result.available.length} pod${result.available.length === 1 ? '' : 's'} free ${start}–${endTime}`
                : `No pods free ${start}–${endTime}`}
            </h2>
            <span className="muted small">{formatDate(date, config.today)}</span>
          </div>

          {result.suggestions && (
            <div className="card stack">
              <h3>Nearest alternatives</h3>
              {result.suggestions.alternativeTimes.length > 0 && (
                <div className="row">
                  <span className="muted small">Other times:</span>
                  {result.suggestions.alternativeTimes.map((t) => (
                    <button key={t.startTime} className="secondary small" onClick={() => set({ start: t.startTime })}>
                      {t.startTime} · {t.availableCount} free
                    </button>
                  ))}
                </div>
              )}
              {result.suggestions.alternativeLocations.length > 0 && (
                <div className="row">
                  <span className="muted small">Same time elsewhere:</span>
                  {result.suggestions.alternativeLocations.map((p) => (
                    <button key={p.id} className="secondary small" onClick={() => set({ building: p.building, floor: String(p.floor) })}>
                      {p.name} · {p.building} F{p.floor}
                    </button>
                  ))}
                </div>
              )}
              {!result.suggestions.alternativeTimes.length && !result.suggestions.alternativeLocations.length && (
                <p className="muted">Everything matching is booked around this time. Try another day.</p>
              )}
            </div>
          )}

          <div className="grid">
            {result.pods
              .slice()
              .sort((a, b) => Number(b.available) - Number(a.available))
              .map(({ pod, busy, available }) => (
                <div key={pod.id} className="card pod-card" style={{ opacity: available ? 1 : 0.6 }}>
                  <div className="row spread">
                    <h3>{pod.name}</h3>
                    <span className="badge">{pod.capacity === 1 ? 'Solo' : `Up to ${pod.capacity}`}</span>
                  </div>
                  <div className="muted small">
                    {pod.building} · Floor {pod.floor} · <span className="mono">{pod.label}</span>
                  </div>
                  {pod.amenities.length > 0 && (
                    <div className="chips">
                      {pod.amenities.map((a) => (
                        <span key={a} className="chip">
                          {a}
                        </span>
                      ))}
                    </div>
                  )}
                  {hours && <Timeline hours={hours} busy={busy} selection={{ start, duration }} />}
                  {available ? (
                    user?.kind === 'student' ? (
                      <button onClick={() => setSelected(pod)} disabled={!!active}>
                        Reserve {start}–{endTime}
                      </button>
                    ) : user ? null : (
                      <a className="btn" href={`/login?returnTo=${encodeURIComponent(location.pathname + location.search)}`}>
                        Sign in to reserve
                      </a>
                    )
                  ) : (
                    <span className="muted small">Booked during this time</span>
                  )}
                </div>
              ))}
          </div>
          {result.pods.length === 0 && <div className="empty">No pods match these filters.</div>}
        </>
      )}

      <Modal open={!!selected} onClose={() => setSelected(null)}>
        {selected && (
          <div className="stack">
            <h2>Confirm reservation</h2>
            <dl className="meta">
              <dt>Pod</dt>
              <dd>
                {selected.name} ({selected.label})
              </dd>
              <dt>Where</dt>
              <dd>
                {selected.building}, Floor {selected.floor}
              </dd>
              <dt>When</dt>
              <dd>
                {formatDate(date, config.today)}, {start}–{endTime}
              </dd>
            </dl>
            <p className="muted small">
              Check in within {config.policy.gracePeriodMinutes} minutes of {start} or the pod is released to other students.
            </p>
            <div className="row">
              <button onClick={confirm}>Confirm booking</button>
              <button className="secondary" onClick={() => setSelected(null)}>
                Back
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
