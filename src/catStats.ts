import { CatRecord } from './types';

/** Count a cat's records whose start_time (epoch seconds) is at/after local midnight of `nowMs`. */
export function visitsToday(records: CatRecord[], catId: string, nowMs: number): number {
  const start = new Date(nowMs);
  start.setHours(0, 0, 0, 0);
  const midnightSec = Math.floor(start.getTime() / 1000);
  return records.filter(r => r.cat_id === catId && r.start_time >= midnightSec).length;
}
