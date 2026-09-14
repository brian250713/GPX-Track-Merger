import { describe, expect, it } from 'vitest';
import { formatDateRange } from '../src/card/renderCard';
import { webMercator } from '../src/core/geo';

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
