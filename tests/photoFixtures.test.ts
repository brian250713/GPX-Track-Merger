/** photo-pins spec scenarios: 讀取照片位置與拍攝時間 / 沒有位置的照片. */
import { Blob as NodeBlob } from 'node:buffer';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { readPhotoMeta } from '../src/core/photoMeta';

const here = dirname(fileURLToPath(import.meta.url));
const photo = (name: string) => {
  // NOTE: jsdom's Blob does not round-trip binary parts through arrayBuffer(),
  // so fixtures use Node's Blob here. Production browsers pass File objects.
  const buf = readFileSync(join(here, 'fixtures', 'photos', name));
  return new NodeBlob([buf]) as unknown as Blob;
};

describe('讀取照片位置與拍攝時間', () => {
  it('JPEG 照片含 GPS：在 (35.0116, 135.7681) 出現圖釘', async () => {
    const meta = await readPhotoMeta(photo('with-gps.jpg'));
    expect(meta).not.toBeNull();
    expect(meta!.lat).toBeCloseTo(35.0116, 4);
    expect(meta!.lon).toBeCloseTo(135.7681, 4);
    expect(meta!.takenAt).toBe('2026-03-12T14:05:33');
  });

  it('南半球與西半球：圖釘位於 (-33.8568, -70.6483)', async () => {
    const meta = await readPhotoMeta(photo('south-west.jpg'));
    expect(meta).not.toBeNull();
    expect(meta!.lat).toBeCloseTo(-33.8568, 4);
    expect(meta!.lon).toBeCloseTo(-70.6483, 4);
  });

  it('有位置但沒有拍攝時間：仍然顯示圖釘', async () => {
    const meta = await readPhotoMeta(photo('no-datetime.jpg'));
    expect(meta).not.toBeNull();
    expect(meta!.lat).toBeCloseTo(35.0116, 4);
    expect(meta!.takenAt).toBeUndefined();
  });
});

describe('沒有位置的照片', () => {
  it('沒有 GPS：計入沒有位置', async () => {
    await expect(readPhotoMeta(photo('no-gps.jpg'))).resolves.toBeNull();
  });

  it('座標為 (0, 0)：不顯示圖釘', async () => {
    await expect(readPhotoMeta(photo('zero-zero.jpg'))).resolves.toBeNull();
  });

  it('損壞的照片：一張失敗不影響其他（回傳 null，不 throw）', async () => {
    await expect(readPhotoMeta(photo('corrupt.jpg'))).resolves.toBeNull();
    // 同一流程中其他照片仍可讀取
    await expect(readPhotoMeta(photo('with-gps.jpg'))).resolves.not.toBeNull();
  });
});
