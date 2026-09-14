import type { TrackPoint } from './types';

const EARTH_RADIUS_M = 6371000;

export function haversineMeters(a: TrackPoint, b: TrackPoint): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

export interface Bounds {
  minLat: number;
  minLon: number;
  maxLat: number;
  maxLon: number;
}

export function computeBounds(points: TrackPoint[]): Bounds | null {
  if (points.length === 0) return null;
  let minLat = Infinity;
  let minLon = Infinity;
  let maxLat = -Infinity;
  let maxLon = -Infinity;
  for (const p of points) {
    if (p.lat < minLat) minLat = p.lat;
    if (p.lon < minLon) minLon = p.lon;
    if (p.lat > maxLat) maxLat = p.lat;
    if (p.lon > maxLon) maxLon = p.lon;
  }
  return { minLat, minLon, maxLat, maxLon };
}

/** Web Mercator projection (for minimal card style), returns x/y in meters-ish units. */
export function webMercator(lat: number, lon: number): { x: number; y: number } {
  const x = (lon * Math.PI) / 180;
  const clamped = Math.max(-85.05112878, Math.min(85.05112878, lat));
  const rad = (clamped * Math.PI) / 180;
  const y = Math.log(Math.tan(Math.PI / 4 + rad / 2));
  return { x, y };
}
