import { describe, expect, it } from 'vitest';
import { addDays, epochToLocal, floorToSlot, localToEpoch, weekdayOf } from '../src/worker/lib/time.js';

describe('campus-local time (SRS 2.4)', () => {
  it('converts Manila wall-clock time to UTC and back', () => {
    const t = localToEpoch('2026-11-09', '14:30', 'Asia/Manila');
    expect(new Date(t).toISOString()).toBe('2026-11-09T06:30:00.000Z');
    expect(epochToLocal(t, 'Asia/Manila')).toMatchObject({ date: '2026-11-09', time: '14:30', weekday: 1 });
  });

  it('handles daylight-saving zones', () => {
    const summer = localToEpoch('2026-07-01', '09:00', 'America/New_York');
    const winter = localToEpoch('2026-12-01', '09:00', 'America/New_York');
    expect(new Date(summer).toISOString()).toBe('2026-07-01T13:00:00.000Z');
    expect(new Date(winter).toISOString()).toBe('2026-12-01T14:00:00.000Z');
  });

  it('floors to the 15-minute slot and does calendar math', () => {
    const t = localToEpoch('2026-11-09', '10:07', 'Asia/Manila');
    expect(epochToLocal(floorToSlot(t, 'Asia/Manila'), 'Asia/Manila').time).toBe('10:00');
    expect(addDays('2026-12-30', 3)).toBe('2027-01-02');
    expect(weekdayOf('2026-11-08')).toBe(0);
  });
});
