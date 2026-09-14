import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseGpx } from '../src/core/parse';

const here = dirname(fileURLToPath(import.meta.url));
const fx = (name: string) => readFileSync(join(here, 'fixtures', name), 'utf8');

describe('gpx-import parse', () => {
  it('parses track with time+ele', () => {
    const r = parseGpx(fx('multi-segment.gpx'));
    expect(r.status).toBe('ok');
    if (r.status === 'ok') {
      expect(r.points).toHaveLength(4);
      expect(r.points[0].ele).toBe(10);
    }
  });

  it('handles missing ele', () => {
    const r = parseGpx(fx('no-ele.gpx'));
    expect(r.status).toBe('ok');
    if (r.status === 'ok') {
      expect(r.points).toHaveLength(2);
      expect(r.points[0].ele).toBeUndefined();
    }
  });

  it('skips timeless points without warning', () => {
    const r = parseGpx(fx('partial-no-time.gpx'));
    expect(r.status).toBe('ok');
    if (r.status === 'ok') expect(r.points).toHaveLength(2);
  });

  it('warns when whole file has no time (rte only)', () => {
    const r = parseGpx(fx('rte-only.gpx'));
    expect(r.status).toBe('no-time');
  });

  it('errors on broken XML', () => {
    const r = parseGpx(fx('broken.gpx'));
    expect(r.status).toBe('error');
  });

  it('errors when only wpt', () => {
    const r = parseGpx(fx('wpt-only.gpx'));
    expect(r.status).toBe('error');
  });
});
