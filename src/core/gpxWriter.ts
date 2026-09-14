import type { Day } from './types';

const GPX_NS = 'http://www.topografix.com/GPX/1/1';
const CREATOR = 'GPX Track Merger';

function el(doc: Document, name: string, text?: string): Element {
  const e = doc.createElementNS(GPX_NS, name);
  if (text !== undefined) e.textContent = text;
  return e;
}

/** Build GPX 1.1 XML string: one <trk> per day, one <trkseg> per segment. */
export function buildGpx(days: Day[], title: string): string {
  const doc = document.implementation.createDocument(GPX_NS, 'gpx', null);
  const root = doc.documentElement;
  root.setAttribute('version', '1.1');
  root.setAttribute('creator', CREATOR);

  const metadata = el(doc, 'metadata');
  metadata.appendChild(el(doc, 'name', title));
  metadata.appendChild(el(doc, 'time', new Date().toISOString()));
  root.appendChild(metadata);

  for (const day of days) {
    const trk = el(doc, 'trk');
    trk.appendChild(el(doc, 'name', `Day ${day.dayIndex} (${day.date})`));
    for (const seg of day.segments) {
      const trkseg = el(doc, 'trkseg');
      for (const p of seg) {
        const trkpt = el(doc, 'trkpt');
        trkpt.setAttribute('lat', String(p.lat));
        trkpt.setAttribute('lon', String(p.lon));
        if (p.ele !== undefined && Number.isFinite(p.ele)) {
          trkpt.appendChild(el(doc, 'ele', String(p.ele)));
        }
        trkpt.appendChild(el(doc, 'time', p.time.toISOString()));
        trkseg.appendChild(trkpt);
      }
      trk.appendChild(trkseg);
    }
    root.appendChild(trk);
  }

  return new XMLSerializer().serializeToString(doc);
}

/** `{title or trip}_{firstDate}.gpx` with illegal filename chars removed. */
export function gpxFileName(title: string, firstDate: string): string {
  const base = title.trim() === '' ? 'trip' : title.trim();
  const safe = base.replace(/[/\\?%*:|"<>]/g, '').trim() || 'trip';
  return `${safe}_${firstDate}.gpx`;
}
