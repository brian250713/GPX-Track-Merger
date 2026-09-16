import { describe, expect, it } from 'vitest';
import { computeElevationProfile } from '../src/core/elevation';
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
