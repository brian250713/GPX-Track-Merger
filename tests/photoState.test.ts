import { describe, expect, it } from 'vitest';
import { AppState } from '../src/state';
import type { PhotoMeta } from '../src/core/photoMeta';

const f = (name: string) => new File(['x'], name);
const ok =
  (lat = 35, lon = 135, takenAt = '2026-03-12T14:05:33'): ((b: Blob) => Promise<PhotoMeta | null>) =>
  async () => ({ lat, lon, takenAt });
const missing =
  (): ((b: Blob) => Promise<PhotoMeta | null>) =>
  async () => null;

describe('photo state', () => {
  it('處理完成後狀態中沒有 File／Blob／object URL', async () => {
    const state = new AppState();
    await state.addPhotos([f('a.jpg'), f('b.heic')], ok());
    expect(state.photos).toHaveLength(2);
    for (const p of state.photos) {
      expect(Object.keys(p).sort()).toEqual(['id', 'lat', 'lon', 'name', 'takenAt']);
      expect(typeof p.name).toBe('string');
    }
    expect(JSON.stringify(state.photos)).not.toContain('blob:');
    expect(state.photoPending).toBeNull();
  });

  it('分兩次加入時計數累加', async () => {
    const state = new AppState();
    await state.addPhotos([f('a.jpg'), f('b.jpg')], ok());
    // 第二批：1 張有位置、1 張沒有位置
    let n = 0;
    await state.addPhotos([f('c.jpg'), f('d.jpg')], async () => {
      n += 1;
      return n === 1 ? { lat: 1, lon: 2 } : null;
    });
    expect(state.photos).toHaveLength(3);
    expect(state.photoMissingCount).toBe(1);
    expect(state.photoPending).toBeNull();
  });

  it('讀取中清除照片後不會再出現圖釘', async () => {
    const state = new AppState();
    let release!: () => void;
    const gate = new Promise<void>((r) => {
      release = r;
    });
    const pending = state.addPhotos(
      [f('a.jpg'), f('b.jpg')],
      async () => {
        await gate;
        return { lat: 1, lon: 2 };
      },
    );
    state.clearPhotos();
    release();
    await pending;
    expect(state.photos).toHaveLength(0);
    expect(state.photoMissingCount).toBe(0);
    expect(state.photoPending).toBeNull();
  });

  it('清除照片不影響 files、days；只有照片時 days 為空', async () => {
    const state = new AppState();
    await state.addPhotos([f('a.jpg')], ok());
    expect(state.days).toHaveLength(0);
    state.clearPhotos();
    expect(state.photos).toHaveLength(0);
    expect(state.files).toHaveLength(0);
    expect(state.days).toHaveLength(0);
    // 之後再加入時張數從 0 開始
    await state.addPhotos([f('b.jpg')], missing());
    expect(state.photos).toHaveLength(0);
    expect(state.photoMissingCount).toBe(1);
  });

  it('讀取中顯示處理中狀態，完成後清除', async () => {
    const state = new AppState();
    let release!: () => void;
    const gate = new Promise<void>((r) => {
      release = r;
    });
    const pending = state.addPhotos(
      [f('a.jpg'), f('b.jpg')],
      async () => {
        await gate;
        return { lat: 1, lon: 2 };
      },
    );
    expect(state.photoPending).toEqual({ done: 0, total: 2 });
    release();
    await pending;
    expect(state.photoPending).toBeNull();
    expect(state.photos).toHaveLength(2);
  });
});
