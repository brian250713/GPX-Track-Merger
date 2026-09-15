// Generates privacy-safe synthetic JPEG fixtures with EXIF (no real location data
// beyond well-known public landmarks used as test coordinates).
// Run: node scripts/gen-photo-fixtures.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, '..', 'tests', 'fixtures', 'photos');
mkdirSync(outDir, { recursive: true });

function dmsRationals(dec) {
  const abs = Math.abs(dec);
  const deg = Math.floor(abs);
  const minFloat = (abs - deg) * 60;
  const min = Math.floor(minFloat);
  const secFloat = (minFloat - min) * 60;
  const secNum = Math.round(secFloat * 100);
  return { deg, min, secNum, secDen: 100 };
}

function asciiBytes(s) {
  const b = Buffer.from(s, 'ascii');
  return Buffer.concat([b, Buffer.from([0])]);
}

// Build a little-endian TIFF block. gps: {lat, lon} | null, datetime: string | null.
function buildTiff(gps, datetime) {
  const parts = [];
  const headerLen = 8;
  // IFD0: entries for GPS pointer and/or Exif pointer
  const ifd0Entries = [];
  if (gps) ifd0Entries.push({ tag: 0x8825, type: 4, count: 1 }); // LONG
  if (datetime) ifd0Entries.push({ tag: 0x8769, type: 4, count: 1 });
  const ifd0Len = 2 + ifd0Entries.length * 12 + 4;
  let cursor = headerLen + ifd0Len;
  const gpsOffset = gps ? cursor : 0;
  // GPS IFD size: count(2) + 4 entries*12 + next(4) + data (refs + rationals)
  const gpsDataLen = 8 + 48; // latRef(2+pad as value) ... compute below
  if (gps) cursor += 2 + 4 * 12 + 4 + 8 + 48;
  const exifOffset = datetime ? cursor : 0;
  if (datetime) cursor += 2 + 12 + 4 + 20;

  const buf = Buffer.alloc(cursor);
  buf.write('II', 0, 'ascii');
  buf.writeUInt16LE(42, 2);
  buf.writeUInt32LE(8, 4);
  // IFD0
  let p = 8;
  buf.writeUInt16LE(ifd0Entries.length, p); p += 2;
  for (const e of ifd0Entries) {
    buf.writeUInt16LE(e.tag, p);
    buf.writeUInt16LE(e.type, p + 2);
    buf.writeUInt32LE(e.count, p + 4);
    buf.writeUInt32LE(e.tag === 0x8825 ? gpsOffset : exifOffset, p + 8);
    p += 12;
  }
  buf.writeUInt32LE(0, p); p += 4;

  if (gps) {
    const { lat, lon } = gps;
    const latD = dmsRationals(lat);
    const lonD = dmsRationals(lon);
    p = gpsOffset;
    buf.writeUInt16LE(4, p); p += 2;
    const latRef = lat < 0 ? 'S' : 'N';
    const lonRef = lon < 0 ? 'W' : 'E';
    const latValOff = gpsOffset + 2 + 48 + 4;
    const lonValOff = latValOff + 24;
    const entries = [
      { tag: 0x0001, type: 2, count: 2, inline: latRef },
      { tag: 0x0002, type: 5, count: 3, val: latValOff },
      { tag: 0x0003, type: 2, count: 2, inline: lonRef },
      { tag: 0x0004, type: 5, count: 3, val: lonValOff },
    ];
    for (const e of entries) {
      buf.writeUInt16LE(e.tag, p);
      buf.writeUInt16LE(e.type, p + 2);
      buf.writeUInt32LE(e.count, p + 4);
      if (e.inline) {
        buf.write(e.inline, p + 8, 'ascii');
        buf[p + 9] = 0; buf[p + 10] = 0; buf[p + 11] = 0;
      } else {
        buf.writeUInt32LE(e.val, p + 8);
      }
      p += 12;
    }
    buf.writeUInt32LE(0, p); p += 4;
    // rationals
    const writeRat = (pos, num, den) => { buf.writeUInt32LE(num, pos); buf.writeUInt32LE(den, pos + 4); };
    writeRat(latValOff, latD.deg, 1); writeRat(latValOff + 8, latD.min, 1); writeRat(latValOff + 16, latD.secNum, latD.secDen);
    writeRat(lonValOff, lonD.deg, 1); writeRat(lonValOff + 8, lonD.min, 1); writeRat(lonValOff + 16, lonD.secNum, lonD.secDen);
    p = latValOff + 48;
  }

  if (datetime) {
    p = exifOffset;
    buf.writeUInt16LE(1, p); p += 2;
    buf.writeUInt16LE(0x9003, p); // DateTimeOriginal
    buf.writeUInt16LE(2, p + 2); // ASCII
    buf.writeUInt32LE(20, p + 4);
    buf.writeUInt32LE(exifOffset + 2 + 12 + 4, p + 8);
    p += 12;
    buf.writeUInt32LE(0, p); p += 4;
    Buffer.from(datetime + '\0', 'ascii').copy(buf, p);
  }
  void parts;
  return buf;
}

function buildJpeg(gps, datetime) {
  const tiff = buildTiff(gps, datetime);
  const exifHeader = Buffer.from('Exif\0\0', 'ascii');
  const app1Body = Buffer.concat([exifHeader, tiff]);
  const app1Len = app1Body.length + 2;
  const app1 = Buffer.alloc(2 + 2 + app1Body.length);
  app1[0] = 0xff; app1[1] = 0xe1;
  app1.writeUInt16BE(app1Len, 2);
  app1Body.copy(app1, 4);
  return Buffer.concat([Buffer.from([0xff, 0xd8]), app1, Buffer.from([0xff, 0xd9])]);
}

const specs = [
  { file: 'with-gps.jpg', gps: { lat: 35.0116, lon: 135.7681 }, datetime: '2026:03:12 14:05:33' },
  { file: 'south-west.jpg', gps: { lat: -33.8568, lon: -70.6483 }, datetime: '2026:03:12 14:05:33' },
  { file: 'no-gps.jpg', gps: null, datetime: '2026:03:12 14:05:33' },
  { file: 'zero-zero.jpg', gps: { lat: 0, lon: 0 }, datetime: '2026:03:12 14:05:33' },
  { file: 'no-datetime.jpg', gps: { lat: 35.0116, lon: 135.7681 }, datetime: null },
];
for (const s of specs) {
  writeFileSync(join(outDir, s.file), buildJpeg(s.gps, s.datetime));
  console.log('wrote', s.file);
}
writeFileSync(join(outDir, 'corrupt.jpg'), Buffer.from([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]));
console.log('wrote corrupt.jpg');
