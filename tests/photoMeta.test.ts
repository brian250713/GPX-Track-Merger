import { describe, expect, it } from 'vitest';
import {
  classifyFile,
  formatTakenAt,
  normalizeGps,
  parseExifDateTime,
  readPhotoMeta,
} from '../src/core/photoMeta';

describe('classifyFile', () => {
  it('routes .gpx to gpx (case-insensitive)', () => {
    expect(classifyFile('trip.gpx')).toBe('gpx');
    expect(classifyFile('TRIP.GPX')).toBe('gpx');
    expect(classifyFile('a.b.gpx')).toBe('gpx');
  });

  it('routes jpeg/heic variants to photo (case-insensitive)', () => {
    for (const n of ['a.jpg', 'a.JPG', 'a.jpeg', 'a.JPEG', 'a.heic', 'a.HEIC', 'a.heif', 'a.HEIF']) {
      expect(classifyFile(n)).toBe('photo');
    }
  });

  it('routes everything else to unsupported', () => {
    for (const n of ['a.png', 'a.webp', 'a.mp4', 'a', '.gpxx', 'gpx', 'a.Gpx.bak']) {
      expect(classifyFile(n)).toBe('unsupported');
    }
  });
});

describe('normalizeGps', () => {
  it('accepts valid coords including southern/western hemispheres', () => {
    expect(normalizeGps(35.0116, 135.7681)).toEqual({ lat: 35.0116, lon: 135.7681 });
    expect(normalizeGps(-33.8568, -70.6483)).toEqual({ lat: -33.8568, lon: -70.6483 });
    expect(normalizeGps(-90, -180)).toEqual({ lat: -90, lon: -180 });
    expect(normalizeGps(90, 180)).toEqual({ lat: 90, lon: 180 });
  });

  it('rejects out-of-range, (0,0), and non-numbers', () => {
    expect(normalizeGps(90.1, 0)).toBeNull();
    expect(normalizeGps(0, 180.1)).toBeNull();
    expect(normalizeGps(0, 0)).toBeNull();
    expect(normalizeGps(NaN, 10)).toBeNull();
    expect(normalizeGps(10, Infinity)).toBeNull();
    expect(normalizeGps('35', '135')).toBeNull();
    expect(normalizeGps(undefined, undefined)).toBeNull();
  });
});

describe('parseExifDateTime / formatTakenAt', () => {
  it('converts EXIF format to takenAt and display strings', () => {
    expect(parseExifDateTime('2026:03:12 14:05:33')).toBe('2026-03-12T14:05:33');
    expect(formatTakenAt('2026-03-12T14:05:33')).toBe('2026.03.12 14:05');
  });

  it('returns undefined for empty, zero, and malformed values', () => {
    expect(parseExifDateTime(undefined)).toBeUndefined();
    expect(parseExifDateTime('')).toBeUndefined();
    expect(parseExifDateTime('0000:00:00 00:00:00')).toBeUndefined();
    expect(parseExifDateTime('2026-03-12 14:05:33')).toBeUndefined();
    expect(parseExifDateTime('2026:13:12 14:05:33')).toBeUndefined();
    expect(parseExifDateTime('2026:03:12 25:05:33')).toBeUndefined();
    expect(formatTakenAt(undefined)).toBeUndefined();
    expect(formatTakenAt('not-a-date')).toBeUndefined();
  });
});

describe('readPhotoMeta', () => {
  // Minimal 1x1 JPEG without EXIF (SOI + JFIF + EOI); must resolve to null, not throw.
  const tinyJpg = new Uint8Array([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00,
    0x01, 0x00, 0x01, 0x00, 0x00, 0xff, 0xd9,
  ]);

  it('returns null for photos without GPS instead of throwing', async () => {
    await expect(readPhotoMeta(new Blob([tinyJpg], { type: 'image/jpeg' }))).resolves.toBeNull();
  });

  it('returns null for corrupt files instead of throwing', async () => {
    const bad = new Blob([new Uint8Array([0, 1, 2, 3, 4, 5])], { type: 'image/jpeg' });
    await expect(readPhotoMeta(bad)).resolves.toBeNull();
  });

  it('reads GPS + DateTimeOriginal through exifreader (mocked HEIC-like tags)', async () => {
    const { default: ExifReader } = await import('exifreader');
    const origLoad = ExifReader.load;
    (ExifReader as unknown as Record<string, unknown>)['load'] = () => ({
      gps: { Latitude: -33.8568, Longitude: -70.6483 },
      exif: { DateTimeOriginal: { description: '2026:03:12 14:05:33' } },
    });
    try {
      await expect(readPhotoMeta(new Blob([tinyJpg]))).resolves.toEqual({
        lat: -33.8568,
        lon: -70.6483,
        takenAt: '2026-03-12T14:05:33',
      });
    } finally {
      (ExifReader as unknown as Record<string, unknown>)['load'] = origLoad;
    }
  });
});
