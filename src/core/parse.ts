import { gpx as gpxToGeoJSON } from '@tmcw/togeojson';
import type { ParseResult, TrackPoint } from './types';

function childTextNS(parent: Element, localName: string): string | undefined {
  const list = parent.getElementsByTagNameNS('*', localName);
  // Only direct children count (avoid picking nested deeper elements, though
  // trkpt has no nested trkpt so first match in subtree is fine; still verify parent).
  for (let i = 0; i < list.length; i++) {
    const el = list[i];
    if (el.parentNode === parent) return el.textContent ?? undefined;
  }
  return undefined;
}

/**
 * Parse GPX text into TrackPoints (covers <trk> and <rte>).
 * - Uses togeojson to validate/convert geometry (D3), then extracts
 *   per-point data from the DOM so timeless points stay aligned
 *   (togeojson drops missing times but keeps coordinates, which
 *   misaligns index-based mapping).
 * - Drops points without valid time.
 * - Returns no-time warning when zero timed points but XML is valid.
 * - Returns error on malformed XML or when no track/route points exist at all.
 */
export function parseGpx(text: string): ParseResult {
  let doc: Document;
  try {
    const parser = new DOMParser();
    doc = parser.parseFromString(text, 'application/xml');
  } catch {
    return { status: 'error', points: [], message: 'GPX 解析失敗：XML 格式錯誤' };
  }

  if (doc.querySelector('parsererror')) {
    return { status: 'error', points: [], message: 'GPX 解析失敗：XML 格式錯誤' };
  }

  // Validate via togeojson (D3): ensures the file actually contains
  // convertible track/route geometry.
  let sawGeometry = false;
  try {
    const geojson = gpxToGeoJSON(doc) as {
      features?: Array<{ geometry?: { type?: string; coordinates?: unknown } }>;
    };
    for (const f of geojson.features ?? []) {
      const t = f.geometry?.type;
      const coords = f.geometry?.coordinates;
      if ((t === 'LineString' || t === 'MultiLineString') && Array.isArray(coords) && coords.length > 0) {
        sawGeometry = true;
        break;
      }
    }
  } catch {
    return { status: 'error', points: [], message: 'GPX 解析失敗：無法轉換軌跡' };
  }

  // Namespace-agnostic point extraction in document order.
  const trkpts = Array.from(doc.getElementsByTagNameNS('*', 'trkpt'));
  const rtepts = Array.from(doc.getElementsByTagNameNS('*', 'rtept'));
  const nodes = [...trkpts, ...rtepts];
  // getElementsByTagNameNS returns document order per tag; trk usually comes
  // before rte in the file, but sort by document position to be safe.
  nodes.sort((a, b) =>
    a === b ? 0 : a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1,
  );

  if (nodes.length === 0 || !sawGeometry) {
    return { status: 'error', points: [], message: '找不到軌跡' };
  }

  const points: TrackPoint[] = [];
  for (const node of nodes) {
    const lat = Number(node.getAttribute('lat'));
    const lon = Number(node.getAttribute('lon'));
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    const timeText = childTextNS(node, 'time');
    if (!timeText) continue; // skip timeless points
    const time = new Date(timeText.trim());
    if (Number.isNaN(time.getTime())) continue;
    const eleText = childTextNS(node, 'ele');
    const ele = eleText !== undefined ? Number(eleText.trim()) : NaN;
    points.push(
      Number.isFinite(ele) ? { lat, lon, ele, time } : { lat, lon, time },
    );
  }

  if (points.length === 0) {
    return { status: 'no-time', points: [], message: '沒有時間資訊，無法分天' };
  }
  return { status: 'ok', points };
}
