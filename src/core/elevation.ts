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

export interface ElevationGain {
  /** Cumulative ascent in meters (threshold-filtered). */
  ascentM: number;
  /** Cumulative descent in meters (threshold-filtered). */
  descentM: number;
  /** False when fewer than 2 usable points exist (same rule as profile). */
  hasData: boolean;
}

/**
 * Elevation noise amplitude in meters (±T): swings that stay within a band
 * of `2 * T` are treated as GPS altitude noise and never count toward
 * ascent/descent. Filters noise from phone-recorded tracks.
 */
export const ASCENT_THRESHOLD_M = 5;

/**
 * Ascent/descent of one run of elevations, by turning points.
 *
 * A turn is confirmed only when the elevation retreats strictly more than
 * `2 * T` from the running extreme; each confirmed leg counts in full from
 * the previous turning point to that extreme. Until the first leg, the run's
 * min and max are tracked and the direction is set once they differ by more
 * than `2 * T`. The final pending leg is counted at the end.
 */
function turningPointGain(eles: number[]): { ascentM: number; descentM: number } {
  const band = 2 * ASCENT_THRESHOLD_M;
  let ascentM = 0;
  let descentM = 0;
  if (eles.length === 0) return { ascentM, descentM };

  let dir = 0;
  let lo = eles[0];
  let hi = eles[0];
  let pivot = eles[0];
  let ext = eles[0];
  for (const e of eles) {
    if (dir === 0) {
      lo = Math.min(lo, e);
      hi = Math.max(hi, e);
      if (hi - lo > band) {
        dir = e === hi ? 1 : -1;
        pivot = dir === 1 ? lo : hi;
        ext = e;
      }
    } else if (dir === 1) {
      if (e > ext) ext = e;
      else if (ext - e > band) {
        ascentM += ext - pivot;
        pivot = ext;
        ext = e;
        dir = -1;
      }
    } else {
      if (e < ext) ext = e;
      else if (e - ext > band) {
        descentM += pivot - ext;
        pivot = ext;
        ext = e;
        dir = 1;
      }
    }
  }
  if (dir === 1) ascentM += ext - pivot;
  else if (dir === -1) descentM += pivot - ext;
  return { ascentM, descentM };
}

/**
 * Compute cumulative ascent/descent for a day, per segment (never across
 * a segment break). Points without elevation are skipped without breaking
 * the segment. See `turningPointGain` for the noise rule.
 */
export function computeElevationGain(day: Day): ElevationGain {
  let ascentM = 0;
  let descentM = 0;
  let count = 0;

  for (const seg of day.segments) {
    const eles: number[] = [];
    for (const p of seg) {
      if (p.ele !== undefined && Number.isFinite(p.ele)) eles.push(p.ele);
    }
    count += eles.length;
    const g = turningPointGain(eles);
    ascentM += g.ascentM;
    descentM += g.descentM;
  }

  if (count < 2) {
    return { ascentM: 0, descentM: 0, hasData: false };
  }
  return { ascentM, descentM, hasData: true };
}

/**
 * Total ascent over all days in meters.
 * Days without elevation data contribute 0.
 * Returns `null` when no day has elevation data.
 */
export function totalAscentM(days: Day[]): number | null {
  let total = 0;
  let any = false;
  for (const day of days) {
    const g = computeElevationGain(day);
    if (g.hasData) {
      any = true;
      total += g.ascentM;
    }
  }
  return any ? total : null;
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
