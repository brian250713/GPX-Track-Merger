import { describe, expect, it } from 'vitest';
import { buildGpx, gpxFileName } from '../src/core/gpxWriter';
import { parseGpx } from '../src/core/parse';
import type { Day } from '../src/core/types';

const day = (dayIndex: number, date: string, segs: [number, number, string][][]): Day => ({
  dayIndex,
  date,
  color: '#E53935',
  segments: segs.map((s) =>
    s.map(([lat, lon, iso]) => ({ lat, lon, time: new Date(iso) })),
  ),
  distanceKm: 0,
});

describe('gpx-export', () => {
  it('exports one trk per day with trkseg per segment', () => {
    const days = [
      day(1, '2026-03-12', [
        [[25.03, 121.56, '2026-03-12T01:00:00Z']],
        [[25.04, 121.57, '2026-03-12T02:00:00Z']],
      ]),
      day(2, '2026-03-13', [[[25.05, 121.58, '2026-03-13T01:00:00Z']]]),
    ];
    const xml = buildGpx(days, 'Trip');
    expect(xml).toContain('<name>Day 1 (2026-03-12)</name>');
    expect(xml).toContain('<name>Day 2 (2026-03-13)</name>');
    // round-trip: re-parse text via DOM to count trk/trkseg
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    expect(doc.querySelector('parsererror')).toBeNull();
    const NS = 'http://www.topografix.com/GPX/1/1';
    expect(doc.getElementsByTagNameNS(NS, 'trk').length).toBe(2);
    expect(doc.getElementsByTagNameNS(NS, 'trkseg').length).toBe(3);
  });

  it('keeps single-point segments', () => {
    const days = [day(1, '2026-03-12', [[[25.03, 121.56, '2026-03-12T01:00:00Z']]])];
    const xml = buildGpx(days, 'Trip');
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    expect(doc.getElementsByTagNameNS('http://www.topografix.com/GPX/1/1', 'trkpt').length).toBe(1);
  });

  it('outputs UTC time and omits ele when missing', () => {
    const days = [day(1, '2026-03-12', [[[25.03, 121.56, '2026-03-12T01:00:00Z']]])];
    const xml = buildGpx(days, 'Trip');
    expect(xml).toContain('2026-03-12T01:00:00.000Z');
    expect(xml).not.toContain('<ele>');
  });

  it('includes ele when present', () => {
    const days: Day[] = [
      {
        dayIndex: 1,
        date: '2026-03-12',
        color: '#E53935',
        segments: [[{ lat: 25.03, lon: 121.56, ele: 10, time: new Date('2026-03-12T01:00:00Z') }]],
        distanceKm: 0,
      },
    ];
    expect(buildGpx(days, 'Trip')).toContain('<ele>10</ele>');
  });

  it('escapes title in metadata and sanitizes filename', () => {
    const days = [day(1, '2026-03-12', [[[25.03, 121.56, '2026-03-12T01:00:00Z']]])];
    const xml = buildGpx(days, 'A/B <test>');
    expect(xml).toContain('A/B &lt;test&gt;');
    expect(gpxFileName('A/B <test>', '2026-03-12')).toBe('AB test_2026-03-12.gpx');
    expect(gpxFileName('', '2026-03-12')).toBe('trip_2026-03-12.gpx');
    expect(gpxFileName('京都・大阪 5 日', '2026-03-12')).toBe('京都・大阪 5 日_2026-03-12.gpx');
  });

  it('round-trips point count through parse', () => {
    const days = [
      day(1, '2026-03-12', [
        [
          [25.03, 121.56, '2026-03-12T01:00:00Z'],
          [25.031, 121.561, '2026-03-12T01:00:10Z'],
        ],
      ]),
    ];
    const xml = buildGpx(days, 'Trip');
    const r = parseGpx(xml);
    expect(r.status).toBe('ok');
    if (r.status === 'ok') expect(r.points).toHaveLength(2);
  });
});
