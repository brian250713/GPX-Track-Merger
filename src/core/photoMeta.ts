/** Photo EXIF helpers (photo-pins). Pure functions + a thin EXIF-reader wrapper. */

export type FileKind = 'gpx' | 'photo' | 'unsupported';

/** D3: classify by file extension (case-insensitive). MIME types are unreliable for HEIC on Windows. */
export function classifyFile(name: string): FileKind {
  const dot = name.lastIndexOf('.');
  const ext = dot >= 0 ? name.slice(dot + 1).toLowerCase() : '';
  if (ext === 'gpx') return 'gpx';
  if (ext === 'jpg' || ext === 'jpeg' || ext === 'heic' || ext === 'heif') return 'photo';
  return 'unsupported';
}

export interface GpsCoord {
  lat: number;
  lon: number;
}

/** Range check; (0, 0) is treated as missing (camera default when no fix). */
export function normalizeGps(lat: unknown, lon: unknown): GpsCoord | null {
  if (typeof lat !== 'number' || typeof lon !== 'number') return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
  if (lat === 0 && lon === 0) return null;
  return { lat, lon };
}

const EXIF_DT_RE = /^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})$/;

/**
 * "2026:03:12 14:05:33" -> "2026-03-12T14:05:33" (no timezone; camera local time).
 * Empty, "0000:00:00 00:00:00", or malformed values return undefined.
 */
export function parseExifDateTime(s: unknown): string | undefined {
  if (typeof s !== 'string') return undefined;
  const m = EXIF_DT_RE.exec(s.trim());
  if (!m) return undefined;
  const [, y, mo, d, h, mi, se] = m;
  if (y === '0000' && mo === '00' && d === '00' && h === '00' && mi === '00' && se === '00') {
    return undefined;
  }
  const month = Number(mo);
  const day = Number(d);
  const hour = Number(h);
  const min = Number(mi);
  const sec = Number(se);
  if (month < 1 || month > 12 || day < 1 || day > 31) return undefined;
  if (hour > 23 || min > 59 || sec > 59) return undefined;
  return `${y}-${mo}-${d}T${h}:${mi}:${se}`;
}

const TAKEN_AT_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/;

/**
 * "2026-03-12T14:05:33" -> "2026.03.12 14:05" (camera local time, never converted).
 * Invalid input returns undefined; callers show「沒有拍攝時間」.
 */
export function formatTakenAt(takenAt: unknown): string | undefined {
  if (typeof takenAt !== 'string') return undefined;
  const m = TAKEN_AT_RE.exec(takenAt.trim());
  if (!m) return undefined;
  const [, y, mo, d, h, mi] = m;
  if (Number(mo) < 1 || Number(mo) > 12 || Number(d) < 1 || Number(d) > 31) return undefined;
  if (Number(h) > 23 || Number(mi) > 59) return undefined;
  return `${y}.${mo}.${d} ${h}:${mi}`;
}

export interface PhotoMeta {
  lat: number;
  lon: number;
  takenAt?: string;
}

/**
 * D2: read GPS + DateTimeOriginal via exifreader (dynamically imported so the
 * chunk only loads when photos are added). Never decodes image data, never
 * throws — any failure returns null (counted as「沒有位置」).
 */
export async function readPhotoMeta(blob: Blob): Promise<PhotoMeta | null> {
  try {
    const mod = (await import('exifreader')) as unknown as Record<string, unknown>;
    const ExifReader = (mod['default'] ?? mod['ExifReader'] ?? mod) as {
      load: (buf: ArrayBuffer, opts?: Record<string, unknown>) => Record<string, unknown>;
    };
    const buf = await blob.arrayBuffer();
    const tags = ExifReader.load(buf, { expanded: true }) as Record<string, unknown>;
    // NOTE: with expanded:true the `gps` group holds plain computed numbers
    // (Latitude/Longitude, negative for S/W), NOT tag objects.
    const gps = tags['gps'] as Record<string, unknown> | undefined;
    const num = (v: unknown): unknown =>
      typeof v === 'number' ? v : (v as { value?: unknown } | null)?.value;
    const coord = normalizeGps(num(gps?.['Latitude']), num(gps?.['Longitude']));
    if (!coord) return null;
    const exif = tags['exif'] as Record<string, { value?: unknown; description?: unknown } | undefined> | undefined;
    const dtRaw = exif?.['DateTimeOriginal'];
    const dtStr =
      typeof dtRaw?.description === 'string'
        ? dtRaw.description
        : typeof dtRaw?.value === 'string'
          ? dtRaw.value
          : undefined;
    const takenAt = parseExifDateTime(dtStr);
    return takenAt ? { ...coord, takenAt } : { ...coord };
  } catch {
    return null;
  }
}
