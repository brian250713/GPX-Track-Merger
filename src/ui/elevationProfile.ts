import { computeElevationProfile, type ElevationProfile } from '../core/elevation';
import type { Day } from '../core/types';

const W = 320;
const H = 140;
const PAD_L = 8;
const PAD_R = 8;
const PAD_T = 18;
const PAD_B = 22;

/** Fallback vertical range (meters) when the whole day is flat. */
export const FLAT_RANGE_M = 10;

function fmtInt(n: number): string {
  return String(Math.round(n));
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * Render a day's elevation profile as a responsive inline SVG string.
 * One `<path>` per segment so gaps stay visually disconnected.
 * Returns '' when the day has insufficient elevation data.
 */
export function renderElevationSvg(day: Day, profile?: ElevationProfile): string {
  const prof = profile ?? computeElevationProfile(day);
  if (!prof.hasData) return '';

  let lo = prof.minEle;
  let hi = prof.maxEle;
  if (!(hi > lo)) {
    // Flat day (or float noise): fall back to a fixed range centered on the value.
    const mid = Number.isFinite(hi) ? hi : 0;
    lo = mid - FLAT_RANGE_M / 2;
    hi = mid + FLAT_RANGE_M / 2;
  }
  const total = Math.max(prof.totalDistanceKm, 1e-9);
  const x = (km: number) => PAD_L + (km / total) * (W - PAD_L - PAD_R);
  // Higher elevation -> smaller y (top of chart).
  const y = (ele: number) => PAD_T + (1 - (ele - lo) / (hi - lo)) * (H - PAD_T - PAD_B);

  const paths = prof.segments
    .filter((seg) => seg.length > 0)
    .map((seg) => {
      if (seg.length === 1) {
        const px = x(seg[0].distanceKm).toFixed(1);
        const py = y(seg[0].ele).toFixed(1);
        return `<path d="M ${px} ${py} L ${px} ${py}" fill="none" stroke="${esc(day.color)}" stroke-width="2" stroke-linecap="round"/>`;
      }
      const d = seg
        .map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(p.distanceKm).toFixed(1)} ${y(p.ele).toFixed(1)}`)
        .join(' ');
      return `<path d="${d}" fill="none" stroke="${esc(day.color)}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
    })
    .join('');

  const midKm = total / 2;
  const label = `${day.date} ${day.distanceKm.toFixed(1)} km，高度 ${fmtInt(prof.minEle)}–${fmtInt(prof.maxEle)} 公尺`;

  return (
    `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(label)}" preserveAspectRatio="xMidYMid meet">` +
    `<title>${esc(label)}</title>` +
    paths +
    `<text x="${PAD_L}" y="12" font-size="11" fill="currentColor">${fmtInt(hi)} m</text>` +
    `<text x="${PAD_L}" y="${H - 2}" font-size="11" fill="currentColor">${fmtInt(lo)} m</text>` +
    `<text x="${W - PAD_R}" y="${H - 2}" font-size="11" fill="currentColor" text-anchor="end">${total.toFixed(1)} km</text>` +
    `<text x="${W / 2}" y="${H - 2}" font-size="11" fill="currentColor" text-anchor="middle">${midKm.toFixed(1)}</text>` +
    `</svg>`
  );
}
