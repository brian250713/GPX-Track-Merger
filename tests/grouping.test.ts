import { describe, expect, it } from 'vitest';
import { groupByDay, mergeAndSort, toLocalDate, totalDistanceKm } from '../src/core/grouping';
import { haversineMeters } from '../src/core/geo';
import type { TrackPoint } from '../src/core/types';

const pt = (lat: number, lon: number, iso: string): TrackPoint => ({
  lat,
  lon,
  time: new Date(iso),
});

describe('day-grouping', () => {
  it('converts UTC to local date by timezone', () => {
    // 2026-03-11T23:30Z is 2026-03-12 in Tokyo
    expect(toLocalDate(new Date('2026-03-11T23:30:00Z'), 'Asia/Tokyo')).toBe('2026-03-12');
  });

  it('merges interleaved files and dedupes timestamps', () => {
    const a = [pt(0, 0, '2026-03-12T09:00:00Z'), pt(0, 0.001, '2026-03-12T10:00:00Z')];
    const b = [pt(0, 0, '2026-03-12T08:00:00Z'), pt(0, 0, '2026-03-12T09:00:00Z')];
    const merged = mergeAndSort([a, b]);
    expect(merged.map((p) => p.time.toISOString())).toEqual([
      '2026-03-12T08:00:00.000Z',
      '2026-03-12T09:00:00.000Z',
      '2026-03-12T10:00:00.000Z',
    ]);
  });

  it('skips dates with no points', () => {
    const pts = [
      pt(25.03, 121.56, '2026-03-12T01:00:00Z'),
      pt(25.03, 121.56, '2026-03-13T01:00:00Z'),
      pt(25.03, 121.56, '2026-03-15T01:00:00Z'),
    ];
    const days = groupByDay(pts, 'Asia/Taipei');
    expect(days.map((d) => d.date)).toEqual(['2026-03-12', '2026-03-13', '2026-03-15']);
    expect(days.map((d) => d.dayIndex)).toEqual([1, 2, 3]);
  });

  it('splits cross-midnight track into two days', () => {
    const pts = [
      pt(25.033, 121.565, '2026-03-12T15:40:00Z'), // 23:40 Taipei
      pt(25.0335, 121.5659, '2026-03-12T15:50:00Z'),
      pt(25.034, 121.566, '2026-03-12T16:05:00Z'), // 00:05 next day
      pt(25.0345, 121.5669, '2026-03-12T16:15:00Z'),
    ];
    const days = groupByDay(pts, 'Asia/Taipei');
    expect(days).toHaveLength(2);
    expect(days[0].segments).toHaveLength(1);
    expect(days[1].segments).toHaveLength(1);
  });

  it('splits on long time gap', () => {
    const pts = [pt(25.03, 121.56, '2026-03-12T01:00:00Z'), pt(25.0305, 121.5605, '2026-03-12T01:45:00Z')];
    const days = groupByDay(pts, 'UTC');
    expect(days[0].segments).toHaveLength(2);
  });

  it('splits on long distance gap', () => {
    const pts = [pt(25.03, 121.56, '2026-03-12T01:00:00Z'), pt(25.15, 121.65, '2026-03-12T01:10:00Z')];
    expect(haversineMeters(pts[0], pts[1])).toBeGreaterThan(5000);
    const days = groupByDay(pts, 'UTC');
    expect(days[0].segments).toHaveLength(2);
  });

  it('keeps continuous points together', () => {
    const pts = [pt(25.03, 121.56, '2026-03-12T01:00:00Z'), pt(25.0301, 121.5601, '2026-03-12T01:00:05Z')];
    const days = groupByDay(pts, 'UTC');
    expect(days[0].segments).toHaveLength(1);
  });

  it('does not split exactly at threshold', () => {
    const pts = [pt(25.03, 121.56, '2026-03-12T01:00:00Z'), pt(25.03, 121.56, '2026-03-12T01:30:00Z')];
    const days = groupByDay(pts, 'UTC');
    expect(days[0].segments).toHaveLength(1);
  });

  it('excludes gap distance from totals', () => {
    const a1 = pt(25.03, 121.56, '2026-03-12T01:00:00Z');
    const a2 = pt(25.031, 121.561, '2026-03-12T01:00:10Z');
    const b1 = pt(26.0, 122.0, '2026-03-12T02:00:00Z');
    const b2 = pt(26.001, 122.001, '2026-03-12T02:00:10Z');
    const days = groupByDay([a1, a2, b1, b2], 'UTC');
    expect(days[0].segments).toHaveLength(2);
    const expected =
      (haversineMeters(a1, a2) + haversineMeters(b1, b2)) / 1000;
    expect(days[0].distanceKm).toBeCloseTo(expected, 6);
  });

  it('sums total distance', () => {
    const days = groupByDay(
      [pt(25.03, 121.56, '2026-03-12T01:00:00Z'), pt(25.03, 121.56, '2026-03-13T01:00:00Z')],
      'UTC',
    );
    expect(totalDistanceKm(days)).toBeGreaterThanOrEqual(0);
  });

  it('handles DST date correctly (America/New_York spring forward 2026)', () => {
    // 2026-03-08 02:00 -> 03:00 in New York. 06:30Z = 01:30 EST, 07:30Z = 03:30 EDT, same local date.
    expect(toLocalDate(new Date('2026-03-08T06:30:00Z'), 'America/New_York')).toBe('2026-03-08');
    expect(toLocalDate(new Date('2026-03-08T07:30:00Z'), 'America/New_York')).toBe('2026-03-08');
  });
});
