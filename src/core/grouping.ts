import { colorForDay } from '../styles/tokens';
import { haversineMeters } from './geo';
import type { Day, TrackPoint } from './types';

/** Gap thresholds: split when interval > 30 min OR distance > 5 km. */
export const GAP_TIME_MS = 30 * 60 * 1000;
export const GAP_DISTANCE_M = 5000;

const dateFormatters = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  let f = dateFormatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    dateFormatters.set(timeZone, f);
  }
  return f;
}

/** UTC Date + IANA time zone -> local YYYY-MM-DD. */
export function toLocalDate(date: Date, timeZone: string): string {
  return formatterFor(timeZone).format(date);
}

/** Merge multiple point lists, sort by time ascending, drop exact-duplicate timestamps. */
export function mergeAndSort(lists: TrackPoint[][]): TrackPoint[] {
  const all = lists.flat();
  all.sort((a, b) => a.time.getTime() - b.time.getTime());
  const out: TrackPoint[] = [];
  let lastMs: number | null = null;
  for (const p of all) {
    const ms = p.time.getTime();
    if (lastMs !== null && ms === lastMs) continue;
    lastMs = ms;
    out.push(p);
  }
  return out;
}

function segmentDistanceKm(segment: TrackPoint[]): number {
  let m = 0;
  for (let i = 1; i < segment.length; i++) {
    m += haversineMeters(segment[i - 1], segment[i]);
  }
  return m / 1000;
}

/** Group sorted points by local date, split gaps, compute distances, assign colors. */
export function groupByDay(sorted: TrackPoint[], timeZone: string): Day[] {
  const byDate = new Map<string, TrackPoint[]>();
  for (const p of sorted) {
    const key = toLocalDate(p.time, timeZone);
    const arr = byDate.get(key);
    if (arr) arr.push(p);
    else byDate.set(key, [p]);
  }
  const dates = [...byDate.keys()].sort();
  return dates.map((date, idx) => {
    const pts = byDate.get(date)!;
    const segments: TrackPoint[][] = [];
    let current: TrackPoint[] = [];
    for (const p of pts) {
      if (current.length === 0) {
        current.push(p);
        continue;
      }
      const prev = current[current.length - 1];
      const dt = p.time.getTime() - prev.time.getTime();
      const dist = haversineMeters(prev, p);
      if (dt > GAP_TIME_MS || dist > GAP_DISTANCE_M) {
        segments.push(current);
        current = [p];
      } else {
        current.push(p);
      }
    }
    if (current.length > 0) segments.push(current);
    const distanceKm = segments.reduce((s, seg) => s + segmentDistanceKm(seg), 0);
    return {
      dayIndex: idx + 1,
      date,
      color: colorForDay(idx + 1),
      segments,
      distanceKm,
    };
  });
}

export function totalDistanceKm(days: Day[]): number {
  return days.reduce((s, d) => s + d.distanceKm, 0);
}
