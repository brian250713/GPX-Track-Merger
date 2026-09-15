import { describe, expect, it } from 'vitest';
import { colorMatchExpression } from '../src/map/mapView';
import type { Day } from '../src/core/types';

const day = (dayIndex: number): Day => ({
  dayIndex,
  date: '2026-03-12',
  color: '#E53935',
  segments: [],
  distanceKm: 0,
});

describe('map color expression', () => {
  it('returns a plain color (no match) when there are no days', () => {
    // Regression: ['match', input, fallback] is invalid — match requires
    // at least input + one label/output pair + fallback. Returning it made
    // MapLibre reject the tracks-colored layer, so uploaded tracks never
    // appeared on the map.
    expect(colorMatchExpression([])).toBe('#000000');
  });

  it('builds a valid match expression when days exist', () => {
    const expr = colorMatchExpression([day(1), day(2)]) as unknown[];
    expect(expr[0]).toBe('match');
    // ['match', input, label, output, label, output, fallback]
    expect(expr).toHaveLength(7);
    expect(expr[expr.length - 1]).toBe('#000000');
  });
});
