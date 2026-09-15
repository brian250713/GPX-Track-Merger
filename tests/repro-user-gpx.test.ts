import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseGpx } from '../src/core/parse';
import { groupByDay, mergeAndSort, totalDistanceKm } from '../src/core/grouping';
import type { TrackPoint } from '../src/core/types';

const dir = join(dirname(fileURLToPath(import.meta.url)), 'gpx');
const hasRealFiles = existsSync(dir) && readdirSync(dir).some((f) => f.endsWith('.gpx'));

describe.skipIf(!hasRealFiles)('real user GPX files (tests/gpx)', () => {
  it('parses every file and groups into drawable days', () => {
    const files = readdirSync(dir).filter((f) => f.endsWith('.gpx'));
    expect(files.length).toBeGreaterThan(0);
    const lists: TrackPoint[][] = [];
    for (const f of files) {
      const r = parseGpx(readFileSync(join(dir, f), 'utf8'));
      expect(r.status, f).toBe('ok');
      if (r.status === 'ok') lists.push(r.points);
    }
    const merged = mergeAndSort(lists);
    expect(merged.length).toBeGreaterThan(0);
    const days = groupByDay(merged, 'Asia/Taipei');
    expect(days.length).toBeGreaterThan(0);
    expect(totalDistanceKm(days)).toBeGreaterThan(0);
    // Every day must have at least one drawable (2+ points) segment,
    // otherwise uploads silently show nothing on the map.
    for (const d of days) {
      expect(
        d.segments.some((s) => s.length >= 2),
        `Day ${d.dayIndex} has no drawable segment`,
      ).toBe(true);
    }
  }, 60000);
});
