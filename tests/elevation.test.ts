import { describe, expect, it } from 'vitest';
import {
  ASCENT_THRESHOLD_M,
  computeElevationGain,
  computeElevationProfile,
  totalAscentM,
} from '../src/core/elevation';
import { haversineMeters } from '../src/core/geo';
import type { Day, TrackPoint } from '../src/core/types';

const T0 = Date.parse('2026-03-12T01:00:00Z');

function pt(lat: number, lon: number, ele: number | undefined, tSec: number): TrackPoint {
  const p: TrackPoint = { lat, lon, time: new Date(T0 + tSec * 1000) };
  if (ele !== undefined) p.ele = ele;
  return p;
}

/** Longitude delta (degrees) for ~`meters` eastward at the equator. */
function lonDelta(meters: number): number {
  return ((meters / 6371000) * 180) / Math.PI;
}

function dayWith(segments: TrackPoint[][]): Day {
  let m = 0;
  for (const seg of segments) {
    for (let i = 1; i < seg.length; i++) m += haversineMeters(seg[i - 1], seg[i]);
  }
  return { dayIndex: 1, date: '2026-03-12', color: '#E53935', segments, distanceKm: m / 1000 };
}

describe('computeElevationProfile', () => {
  it('1.1 single segment: first 0 km / last 8 km', () => {
    const dLon = lonDelta(8000);
    const seg = [pt(0, 0, 40, 0), pt(0, dLon / 2, 180, 60), pt(0, dLon, 320, 120)];
    const day = dayWith([seg]);
    const prof = computeElevationProfile(day);
    expect(prof.hasData).toBe(true);
    expect(prof.segments).toHaveLength(1);
    expect(prof.segments[0][0].distanceKm).toBeCloseTo(0, 6);
    expect(prof.segments[0][0].ele).toBe(40);
    expect(prof.segments[0][prof.segments[0].length - 1].distanceKm).toBeCloseTo(8, 3);
    expect(prof.segments[0][prof.segments[0].length - 1].ele).toBe(320);
  });

  it('1.1 two segments: gap distance excluded (3km + 4km = 7km)', () => {
    // Segment 1: 3 km. Segment 2 far away (50 km gap): 4 km.
    const seg1 = [pt(0, 0, 40, 0), pt(0, lonDelta(3000), 100, 60)];
    const base2 = 50 / 111.195; // ~50 km east in degrees
    const seg2 = [pt(0, base2, 150, 3600), pt(0, base2 + lonDelta(4000), 320, 3660)];
    const day = dayWith([seg1, seg2]);
    const prof = computeElevationProfile(day);
    expect(prof.hasData).toBe(true);
    expect(prof.segments).toHaveLength(2);
    expect(prof.segments[1][0].distanceKm).toBeCloseTo(3, 3);
    const last = prof.segments[1][prof.segments[1].length - 1];
    expect(last.distanceKm).toBeCloseTo(7, 3);
    expect(prof.totalDistanceKm).toBeCloseTo(7, 3);
    expect(prof.totalDistanceKm).toBeCloseTo(day.distanceKm, 9);
  });

  it('1.2 points without ele are skipped but still count toward mileage', () => {
    // 5 points, 1 km apart; middle point has no elevation.
    const seg = [
      pt(0, 0, 10, 0),
      pt(0, lonDelta(1000), 20, 60),
      pt(0, lonDelta(2000), undefined, 120),
      pt(0, lonDelta(3000), 40, 180),
      pt(0, lonDelta(4000), 50, 240),
    ];
    const day = dayWith([seg]);
    const prof = computeElevationProfile(day);
    expect(prof.segments[0]).toHaveLength(4);
    const last = prof.segments[0][prof.segments[0].length - 1];
    expect(last.distanceKm).toBeCloseTo(day.distanceKm, 9);
    expect(last.distanceKm).toBeCloseTo(4, 2);
  });

  it('1.2 leading points without ele do not warp mileage (first point at 2 km)', () => {
    const seg = [
      pt(0, 0, undefined, 0),
      pt(0, lonDelta(1000), undefined, 60),
      pt(0, lonDelta(2000), 100, 120),
      pt(0, lonDelta(3000), 150, 180),
    ];
    const day = dayWith([seg]);
    const prof = computeElevationProfile(day);
    expect(prof.segments[0][0].distanceKm).toBeCloseTo(2, 2);
    expect(prof.segments[0][prof.segments[0].length - 1].distanceKm).toBeCloseTo(
      day.distanceKm,
      9,
    );
  });

  it('1.3 no elevation at all -> explicit no-data result', () => {
    const seg = [pt(0, 0, undefined, 0), pt(0, lonDelta(500), undefined, 60)];
    const prof = computeElevationProfile(dayWith([seg]));
    expect(prof.hasData).toBe(false);
    expect(prof.minEle).not.toBeNaN();
    expect(prof.maxEle).not.toBeNaN();
  });

  it('1.3 single point with elevation -> no-data result', () => {
    const seg = [pt(0, 0, 100, 0), pt(0, lonDelta(500), undefined, 60)];
    const prof = computeElevationProfile(dayWith([seg]));
    expect(prof.hasData).toBe(false);
  });

  it('1.4 flat day: min/max both the single value, no NaN', () => {
    const seg = [
      pt(0, 0, 5, 0),
      pt(0, lonDelta(1000), 5, 60),
      pt(0, lonDelta(2000), 5, 120),
    ];
    const prof = computeElevationProfile(dayWith([seg]));
    expect(prof.hasData).toBe(true);
    expect(prof.minEle).toBe(5);
    expect(prof.maxEle).toBe(5);
    for (const s of prof.segments) {
      for (const p of s) {
        expect(p.distanceKm).not.toBeNaN();
        expect(p.ele).not.toBeNaN();
      }
    }
  });

  it('1.4 min/max over all segments', () => {
    const seg1 = [pt(0, 0, 40, 0), pt(0, lonDelta(1000), 120, 60)];
    const seg2 = [pt(1, 1, 320, 3600), pt(1, 1 + lonDelta(1000), 60, 3660)];
    const prof = computeElevationProfile(dayWith([seg1, seg2]));
    expect(prof.minEle).toBe(40);
    expect(prof.maxEle).toBe(320);
  });
});

/** One segment walking east, one point per `ele` entry (undefined = no `<ele>`). */
function segOf(eles: (number | undefined)[]): TrackPoint[] {
  const step = lonDelta(20);
  return eles.map((e, i) => pt(0, i * step, e, i * 10));
}

const range = (n: number, f: (i: number) => number | undefined) =>
  Array.from({ length: n }, (_, i) => f(i));

/** 100 points, each 1 m higher than the previous (30 -> 129). */
const ramp = range(100, (i) => 30 + i);

describe('computeElevationGain', () => {
  it('1.1 threshold constant is 5 and an empty day has no data', () => {
    expect(ASCENT_THRESHOLD_M).toBe(5);
    expect(computeElevationGain(dayWith([])).hasData).toBe(false);
  });

  it('1.2 monotonic 1 m steps are not underestimated', () => {
    const g = computeElevationGain(dayWith([segOf(ramp)]));
    expect(g.ascentM).toBeGreaterThanOrEqual(95);
    expect(g.ascentM).toBeLessThanOrEqual(100);
    expect(g.descentM).toBe(0);
  });

  it('1.2 rolling terrain: +200, -150, +80', () => {
    const eles = [...range(201, (i) => i), ...range(150, (i) => 199 - i), ...range(80, (i) => 51 + i)];
    const g = computeElevationGain(dayWith([segOf(eles)]));
    expect(g.ascentM).toBeCloseTo(280, 0);
    expect(g.descentM).toBeCloseTo(150, 0);
  });

  it('1.3 ±4 m noise around 40 m never accumulates, whatever the starting phase', () => {
    const phases = [
      range(200, (i) => [40, 44, 40, 36][i % 4]),
      range(200, (i) => (i % 2 ? 44 : 36)),
      range(200, (i) => (i % 2 ? 36 : 44)),
      range(200, (i) => 40 + 4 * Math.sin(i * 1.7)),
    ];
    for (const eles of phases) {
      const g = computeElevationGain(dayWith([segOf(eles)]));
      expect(g.ascentM).toBe(0);
      expect(g.descentM).toBe(0);
    }
  });

  it('1.4 exactly ±5.0 m steps are ignored', () => {
    const g = computeElevationGain(dayWith([segOf(range(40, (i) => (i % 2 ? 5 : 0)))]));
    expect(g.ascentM).toBe(0);
    expect(g.descentM).toBe(0);
  });

  it('1.4 the noise band is strict: a 10.0 m rise is ignored, 10.5 m counts', () => {
    const flatThenUp = (h: number) => [...range(10, () => 100), ...range(10, () => 100 + h)];
    expect(computeElevationGain(dayWith([segOf(flatThenUp(2 * ASCENT_THRESHOLD_M))])).ascentM).toBe(0);
    expect(computeElevationGain(dayWith([segOf(flatThenUp(10.5))])).ascentM).toBeCloseTo(10.5, 6);
  });

  it('1.5 reference resets per segment: the gap between segments is not counted', () => {
    const seg1 = segOf(range(51, (i) => 10 + i));
    const seg2 = segOf(range(51, (i) => 810 + i));
    const g = computeElevationGain(dayWith([seg1, seg2]));
    expect(g.ascentM).toBeCloseTo(100, 0);
    expect(g.descentM).toBe(0);
  });

  it('1.6 points without elevation are skipped without breaking the segment', () => {
    const full = computeElevationGain(dayWith([segOf(ramp)]));
    const holes = computeElevationGain(
      dayWith([segOf(ramp.map((e, i) => (i >= 40 && i < 50 ? undefined : e)))]),
    );
    expect(holes.ascentM).toBe(full.ascentM);
    expect(holes.descentM).toBe(full.descentM);
  });

  it('1.7 fewer than 2 usable points means no data, with finite zeros', () => {
    for (const eles of [
      [undefined, undefined, undefined],
      [undefined, 120, undefined],
    ]) {
      const g = computeElevationGain(dayWith([segOf(eles)]));
      expect(g.hasData).toBe(false);
      expect(g.ascentM).toBe(0);
      expect(g.descentM).toBe(0);
      expect(Number.isFinite(g.ascentM) && Number.isFinite(g.descentM)).toBe(true);
    }
  });

  it('1.8 ascent and descent share the same threshold', () => {
    const up = computeElevationGain(dayWith([segOf(ramp)]));
    const down = computeElevationGain(dayWith([segOf(ramp.map((e) => -(e as number)))]));
    expect(down.descentM).toBe(up.ascentM);
    expect(down.ascentM).toBe(0);
  });
});

describe('totalAscentM', () => {
  it('1.9 sums days (100 / 0 / 250 -> 350)', () => {
    const days = [
      dayWith([segOf([0, 100])]),
      dayWith([segOf([0, 0])]),
      dayWith([segOf([0, 250])]),
    ];
    expect(totalAscentM(days)).toBeCloseTo(350, 6);
  });

  it('1.9 a day without elevation contributes 0', () => {
    const days = [dayWith([segOf([0, 100])]), dayWith([segOf([undefined, undefined])]), dayWith([segOf([0, 250])])];
    expect(totalAscentM(days)).toBeCloseTo(350, 6);
  });

  it('1.9 no elevation on any day -> null', () => {
    const none = () => dayWith([segOf([undefined, undefined])]);
    expect(totalAscentM([none(), none(), none()])).toBeNull();
    expect(totalAscentM([])).toBeNull();
  });
});
