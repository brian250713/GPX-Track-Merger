import { describe, expect, it } from 'vitest';
import { computeElevationProfile } from '../src/core/elevation';
import type { Day, TrackPoint } from '../src/core/types';
import { renderElevationSvg } from '../src/ui/elevationProfile';

const T0 = Date.parse('2026-03-12T01:00:00Z');

function pt(lat: number, lon: number, ele: number | undefined, tSec: number): TrackPoint {
  const p: TrackPoint = { lat, lon, time: new Date(T0 + tSec * 1000) };
  if (ele !== undefined) p.ele = ele;
  return p;
}

function lonDelta(meters: number): number {
  return ((meters / 6371000) * 180) / Math.PI;
}

function twoSegmentDay(): Day {
  const s1 = [pt(0, 0, 40, 0), pt(0, lonDelta(3000), 320, 60)];
  const s2 = [pt(1, 1, 100, 3600), pt(1, 1 + lonDelta(2000), 150, 3660)];
  return { dayIndex: 2, date: '2026-03-12', color: '#1E88E5', segments: [s1, s2], distanceKm: 5 };
}

function flatDay(): Day {
  const seg = [pt(0, 0, 5, 0), pt(0, lonDelta(1000), 5, 60), pt(0, lonDelta(2000), 5, 120)];
  return { dayIndex: 1, date: '2026-03-12', color: '#E53935', segments: [seg], distanceKm: 2 };
}

describe('renderElevationSvg', () => {
  it('2.1 two segments produce two independent paths', () => {
    const day = twoSegmentDay();
    const svg = renderElevationSvg(day);
    const paths = svg.match(/<path /g) ?? [];
    expect(paths).toHaveLength(2);
  });

  it('2.2 flat day renders without NaN', () => {
    const day = flatDay();
    const svg = renderElevationSvg(day);
    expect(svg).not.toBe('');
    expect(svg).not.toMatch(/NaN/);
    expect(svg.match(/<path /g)?.length).toBeGreaterThanOrEqual(1);
  });

  it('2.3 shows min/max elevation and distance ticks', () => {
    const day = twoSegmentDay();
    const prof = computeElevationProfile(day);
    const svg = renderElevationSvg(day, prof);
    expect(svg).toContain(String(Math.round(prof.maxEle)));
    expect(svg).toContain(String(Math.round(prof.minEle)));
    expect(svg).toContain('km');
  });

  it('2.4 responsive viewBox and day color stroke', () => {
    const day = twoSegmentDay();
    const svg = renderElevationSvg(day);
    expect(svg).toContain('viewBox=');
    expect(svg).toContain(`stroke="${day.color}"`);
  });

  it('2.5 text alternative with date, distance and elevation range', () => {
    const day = twoSegmentDay();
    const prof = computeElevationProfile(day);
    const svg = renderElevationSvg(day, prof);
    expect(svg).toMatch(/<title>.*<\/title>/);
    expect(svg).toContain(day.date);
    expect(svg).toContain(day.distanceKm.toFixed(1));
    expect(svg).toContain(String(Math.round(prof.maxEle)));
    expect(svg).toContain('aria-label');
  });

  it('returns empty string when data is insufficient', () => {
    const day: Day = {
      dayIndex: 1,
      date: '2026-03-12',
      color: '#E53935',
      segments: [[pt(0, 0, undefined, 0)]],
      distanceKm: 0,
    };
    expect(renderElevationSvg(day)).toBe('');
  });
});
