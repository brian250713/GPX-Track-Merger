import { describe, expect, it } from 'vitest';
import {
  buildPillTexts,
  CARD_SIZE,
  cardFontSample,
  fitLegendDays,
  formatDateRange,
  formatDayLabel,
  PADDING,
  pillsTotalWidth,
} from '../src/card/renderCard';
import { webMercator } from '../src/core/geo';
import type { Day } from '../src/core/types';

describe('trip-card helpers', () => {
  it('formats multi-day range within a year', () => {
    expect(formatDateRange('2026-03-12', '2026-03-16')).toBe('2026.03.12 – 03.16');
  });

  it('formats single day', () => {
    expect(formatDateRange('2026-03-12', '2026-03-12')).toBe('2026.03.12');
  });

  it('shows full dates across years', () => {
    expect(formatDateRange('2025-12-30', '2026-01-02')).toBe('2025.12.30 – 2026.01.02');
  });

  it('projects with web mercator monotonically', () => {
    const a = webMercator(25.03, 121.56);
    const b = webMercator(25.04, 121.57);
    expect(b.x).toBeGreaterThan(a.x);
    expect(b.y).toBeGreaterThan(a.y);
  });
});

describe('legend month/day labels', () => {
  it('5.1 strips leading zeros', () => {
    expect(formatDayLabel('2026-03-05')).toBe('3/5');
    expect(formatDayLabel('2026-03-12')).toBe('3/12');
  });

  it('5.1 cross-month sequence', () => {
    expect(['2026-03-30', '2026-03-31', '2026-04-01', '2026-04-02'].map(formatDayLabel)).toEqual([
      '3/30',
      '3/31',
      '4/1',
      '4/2',
    ]);
  });

  it('5.2 font preload sample covers the slash', () => {
    expect(cardFontSample('京都・大阪 5 日')).toContain('/');
  });

  it('5.3 five-day trip fits every legend item in one row', () => {
    const days: Day[] = ['2026-03-12', '2026-03-13', '2026-03-14', '2026-03-15', '2026-03-16'].map(
      (date, i) => ({
        dayIndex: i + 1,
        date,
        color: '#E53935',
        segments: [],
        distanceKm: 8,
      }),
    );
    // Conservative width estimate for 44px bold (~26px per glyph).
    const fitted = fitLegendDays(days, (s) => s.length * 26);
    expect(fitted).toHaveLength(5);
    expect(fitted.map((d) => formatDayLabel(d.date))).toEqual(['3/12', '3/13', '3/14', '3/15', '3/16']);
  });
});

describe('total ascent pill', () => {
  it('4.2 content: 5 天 / 42.3 km / 爬升 1240 m', () => {
    expect(buildPillTexts(5, 42.3, 1240)).toEqual(['5 天', '42.3 km', '爬升 1240 m']);
  });

  it('4.2 ascent is rounded to whole meters', () => {
    expect(buildPillTexts(1, 1, 1239.6)[2]).toBe('爬升 1240 m');
  });

  it('4.3 font preload sample covers 爬升', () => {
    expect(cardFontSample('x')).toContain('爬升');
  });

  it('4.4 null ascent draws only two pills, 0 still draws three', () => {
    const none = buildPillTexts(5, 42.3, null);
    expect(none).toEqual(['5 天', '42.3 km']);
    expect(none.join()).not.toContain('爬升');
    expect(buildPillTexts(5, 42.3, 0)[2]).toBe('爬升 0 m');
  });

  it('4.5 widest realistic values stay inside the side margins', () => {
    const texts = buildPillTexts(30, 1234.5, 28500);
    // Worst case for 52px bold: every glyph a full em wide.
    const width = pillsTotalWidth(texts, (s) => s.length * 52);
    expect(width).toBeLessThanOrEqual(CARD_SIZE - PADDING * 2);
  });

  it('4.5 pill width adds padding per pill and gaps between them', () => {
    expect(pillsTotalWidth(['a'], () => 10)).toBe(90);
    expect(pillsTotalWidth(['a', 'b', 'c'], () => 10)).toBe(90 * 3 + 32 * 2);
  });
});
