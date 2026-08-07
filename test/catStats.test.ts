import { visitsToday } from '../src/catStats';
import { CatRecord } from '../src/types';

describe('visitsToday', () => {
  it('counts only records since local midnight', () => {
    const now = new Date('2026-08-07T10:00:00').getTime();
    const midnight = Math.floor(new Date('2026-08-07T00:00:00').getTime() / 1000);
    const recs: CatRecord[] = [
      { cat_id: 'A', weight: 4, start_time: midnight - 3600, end_time: midnight - 3600 }, // yesterday
      { cat_id: 'A', weight: 4, start_time: midnight + 3600, end_time: midnight + 3600 }, // today
      { cat_id: 'A', weight: 4, start_time: midnight + 7200, end_time: midnight + 7200 }, // today
      { cat_id: 'B', weight: 4, start_time: midnight + 60, end_time: midnight + 60 }, // other cat
    ];
    expect(visitsToday(recs, 'A', now)).toBe(2);
  });

  it('counts a record exactly at local midnight as today', () => {
    const now = new Date('2026-08-07T10:00:00').getTime();
    const midnight = Math.floor(new Date('2026-08-07T00:00:00').getTime() / 1000);
    const recs: CatRecord[] = [
      { cat_id: 'A', weight: 4, start_time: midnight, end_time: midnight },
    ];
    expect(visitsToday(recs, 'A', now)).toBe(1);
  });

  it('returns 0 when there are no matching records', () => {
    const now = new Date('2026-08-07T10:00:00').getTime();
    expect(visitsToday([], 'A', now)).toBe(0);
  });
});
