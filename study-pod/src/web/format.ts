import type { AppConfig, ReservationStatus } from './api';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function weekdayOf(date: string): number {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function formatDate(date: string, today?: string): string {
  const [, m, d] = date.split('-').map(Number);
  const label = `${WEEKDAYS[weekdayOf(date)]}, ${MONTHS[m - 1]} ${d}`;
  if (today && date === today) return `Today · ${label}`;
  return label;
}

export const toMinutes = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};
export const toTime = (mins: number) =>
  `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (!h) return `${m} min`;
  if (!m) return `${h} hr`;
  return `${h} hr ${m} min`;
}

/** Start-time options for a date: every 15 minutes inside operating hours, not in the past. */
export function startTimesFor(config: AppConfig, date: string, minDuration: number): string[] {
  const hours = config.operatingHours[String(weekdayOf(date))];
  if (!hours) return [];
  const open = toMinutes(hours.open);
  const close = toMinutes(hours.close);
  const earliest = date === config.today ? Math.floor(toMinutes(config.nowTime) / 15) * 15 : open;
  const out: string[] = [];
  for (let m = Math.max(open, earliest); m + minDuration <= close; m += 15) out.push(toTime(m));
  return out;
}

export function durationsFor(config: AppConfig, date: string, start: string): number[] {
  const hours = config.operatingHours[String(weekdayOf(date))];
  const out: number[] = [];
  const { minDurationMinutes: min, maxDurationMinutes: max } = config.policy;
  for (let d = min; d <= max; d += 15) {
    if (hours && toMinutes(start) + d > toMinutes(hours.close)) break;
    out.push(d);
  }
  return out;
}

export function clock(epoch: number, tz: string): string {
  return new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(epoch);
}

export function dateTime(epoch: number, tz: string): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(epoch);
}

export const STATUS_LABEL: Record<ReservationStatus, string> = {
  Confirmed: 'Confirmed',
  CheckedIn: 'Checked in',
  Completed: 'Completed',
  Cancelled: 'Cancelled',
  NoShow: 'No-show',
};

export const pct = (v: number) => `${(v * 100).toFixed(v < 0.1 && v > 0 ? 1 : 0)}%`;
