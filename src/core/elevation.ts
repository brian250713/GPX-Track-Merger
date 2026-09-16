import { haversineMeters } from './geo';
import type { Day } from './types';

export interface ElevationPoint {
  /** Cumulative distance within the day in km (gap distances excluded). */
  distanceKm: number;
  /** Elevation in meters. */
  ele: number;
}

export interface ElevationProfile {
  /** Per-segment mile–elevation points (only points with elevation). */
  segments: ElevationPoint[][];
  minEle: number;
  maxEle: number;
  /** Total profile length in km; equals day.distanceKm. */
  totalDistanceKm: number;
  /** False when fewer than 2 usable points exist. */
  hasData: boolean;
}

/**
 * Build the distance–elevation profile for a day.
 *
 * Mileage accumulates over the full point sequence (points without elevation
 * still count toward distance) but only within the same segment, so gap
 * distances are excluded — identical semantics to `day.distanceKm`.
 */
export function computeElevationProfile(day: Day): ElevationProfile {
  const segments: ElevationPoint[][] = [];
  let cumulativeM = 0;
  let minEle = Infinity;
  let maxEle = -Infinity;
  let count = 0;

  for (const seg of day.segments) {
    const profSeg: ElevationPoint[] = [];
    for (let i = 0; i < seg.length; i++) {
      if (i > 0) {
        cumulativeM += haversineMeters(seg[i - 1], seg[i]);
      }
      const ele = seg[i].ele;
      if (ele !== undefined && Number.isFinite(ele)) {
        profSeg.push({ distanceKm: cumulativeM / 1000, ele });
        if (ele < minEle) minEle = ele;
        if (ele > maxEle) maxEle = ele;
        count += 1;
      }
    }
    if (profSeg.length > 0) segments.push(profSeg);
  }

  const totalDistanceKm = cumulativeM / 1000;
  if (count < 2) {
    return { segments, minEle: 0, maxEle: 0, totalDistanceKm, hasData: false };
  }
  return { segments, minEle, maxEle, totalDistanceKm, hasData: true };
}
