import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeEach, describe, expect, it } from 'vitest';
import { AppState } from '../src/state';
import { mountFileList } from '../src/ui/fileList';
import { mountPhotoSummary } from '../src/ui/photoSummary';
import type { PhotoMeta } from '../src/core/photoMeta';

const here = dirname(fileURLToPath(import.meta.url));
const gpx = readFileSync(join(here, 'fixtures', 'multi-segment.gpx'), 'utf8');

const f = (name: string) => new File(['x'], name);

function setup() {
  document.body.innerHTML = '<div id="fileBox"></div><div id="photoBox"></div>';
  const files = document.getElementById('fileBox')!;
  const photoBox = document.getElementById('photoBox')!;
  const state = new AppState();
  mountFileList(files, state);
  mountPhotoSummary(photoBox, state, files);
  return { files, photoBox, state };
}

describe('照片摘要與清除照片', () => {
  let ctx: ReturnType<typeof setup>;
  beforeEach(() => {
    ctx = setup();
  });

  it('顯示摘要：分兩次加入累加，檔案清單沒有照片檔名', async () => {
    const reader = async (): Promise<PhotoMeta | null> => ({ lat: 1, lon: 2 });
    await ctx.state.addPhotos([f('a.jpg'), f('b.jpg')], reader);
    let n = 0;
    await ctx.state.addPhotos([f('c.jpg')], async () => {
      n += 1;
      return n === 1 ? null : { lat: 1, lon: 2 };
    });
    expect(ctx.photoBox.textContent).toContain('照片 2 張有位置 · 1 張沒有位置');
    expect(ctx.photoBox.querySelector('#clearPhotosBtn')).not.toBeNull();
    expect(ctx.files.textContent).not.toContain('.jpg');
  });

  it('沒有照片：不顯示摘要與清除按鈕', () => {
    expect(ctx.photoBox.innerHTML).toBe('');
    expect(ctx.photoBox.querySelector('#clearPhotosBtn')).toBeNull();
  });

  it('讀取中：顯示處理中狀態，完成後顯示最終張數', async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => {
      release = r;
    });
    const pending = ctx.state.addPhotos([f('a.jpg'), f('b.jpg')], async () => {
      await gate;
      return { lat: 1, lon: 2 };
    });
    expect(ctx.photoBox.textContent).toContain('讀取照片中… 0／2');
    release();
    await pending;
    expect(ctx.photoBox.textContent).toContain('照片 2 張有位置 · 0 張沒有位置');
  });

  it('清除照片：圖釘與摘要消失，軌跡與統計不變，焦點移到檔案區塊', async () => {
    await ctx.state.addFiles([new File([gpx], 't.gpx')]);
    await ctx.state.addPhotos([f('a.jpg')], async () => ({ lat: 1, lon: 2 }));
    const daysBefore = ctx.state.days.length;
    expect(daysBefore).toBeGreaterThan(0);
    const btn = ctx.photoBox.querySelector<HTMLButtonElement>('#clearPhotosBtn')!;
    btn.focus();
    btn.click();
    expect(ctx.state.photos).toHaveLength(0);
    expect(ctx.photoBox.innerHTML).toBe('');
    expect(ctx.state.days.length).toBe(daysBefore);
    expect(ctx.files.textContent).toContain('t.gpx');
    expect(document.activeElement).toBe(ctx.files);
  });
});
