import { toMinutes, toTime } from '../format';

/** Day strip of 15-minute slots: free, booked, and the currently selected window. */
export function Timeline({
  hours,
  busy,
  selection,
}: {
  hours: { open: string; close: string };
  busy: string[];
  selection?: { start: string; duration: number };
}) {
  const open = toMinutes(hours.open);
  const close = toMinutes(hours.close);
  const busySet = new Set(busy);
  const selStart = selection ? toMinutes(selection.start) : -1;
  const selEnd = selection ? selStart + selection.duration : -1;
  const slots = [];
  for (let m = open; m < close; m += 15) {
    const t = toTime(m);
    const cls = [busySet.has(t) ? 'busy' : '', m >= selStart && m < selEnd ? 'selected' : ''].join(' ');
    slots.push(<span key={t} className={cls} title={`${t} ${busySet.has(t) ? 'booked' : 'free'}`} />);
  }
  return (
    <div>
      <div className="timeline" aria-label={`Bookings between ${hours.open} and ${hours.close}`}>
        {slots}
      </div>
      <div className="timeline-legend">
        <span>{hours.open}</span>
        <span>{toTime(Math.round((open + close) / 2 / 60) * 60)}</span>
        <span>{hours.close}</span>
      </div>
    </div>
  );
}
