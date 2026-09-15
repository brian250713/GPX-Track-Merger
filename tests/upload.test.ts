import { beforeEach, describe, expect, it } from 'vitest';
import { AppState } from '../src/state';
import { ACCEPT, PRIVACY_NOTE, UNSUPPORTED_HINT, mountUpload } from '../src/ui/upload';

const gpxFile = (name: string) => new File(['<gpx></gpx>'], name);
const photoFile = (name: string) => new File(['x'], name);

function setup() {
  document.body.innerHTML = '<div id="uploadBox"></div>';
  const container = document.getElementById('uploadBox')!;
  const state = new AppState();
  const gpxCalls: File[][] = [];
  const photoCalls: File[][] = [];
  state.addFiles = (async (files: File[]) => {
    gpxCalls.push(files);
  }) as AppState['addFiles'];
  state.addPhotos = (async (files: File[]) => {
    photoCalls.push(files);
  }) as AppState['addPhotos'];
  mountUpload(container, state);
  return { container, gpxCalls, photoCalls };
}

function drop(container: HTMLElement, files: File[]) {
  const zone = container.querySelector('#dropzone')!;
  const e = new Event('drop', { bubbles: true }) as Event & { dataTransfer?: { files: File[] } };
  e.dataTransfer = { files };
  zone.dispatchEvent(e);
}

describe('upload routing', () => {
  let ctx: ReturnType<typeof setup>;
  beforeEach(() => {
    ctx = setup();
  });

  it('混合 GPX 與照片：GPX 進入檔案列表，照片交給照片處理', () => {
    drop(ctx.container, [gpxFile('a.gpx'), photoFile('b.jpg'), gpxFile('c.gpx')]);
    expect(ctx.gpxCalls).toHaveLength(1);
    expect(ctx.gpxCalls[0].map((f) => f.name)).toEqual(['a.gpx', 'c.gpx']);
    expect(ctx.photoCalls).toHaveLength(1);
    expect(ctx.photoCalls[0].map((f) => f.name)).toEqual(['b.jpg']);
    expect(ctx.container.querySelector('#uploadMsg')!.textContent).toBe('');
  });

  it('.JPG 大寫副檔名視為照片', () => {
    drop(ctx.container, [photoFile('IMG_0421.JPG')]);
    expect(ctx.photoCalls).toHaveLength(1);
    expect(ctx.gpxCalls).toHaveLength(0);
  });

  it('.png 顯示不支援提示且不加入', () => {
    drop(ctx.container, [new File(['x'], 'a.png')]);
    expect(ctx.container.querySelector('#uploadMsg')!.textContent).toBe(UNSUPPORTED_HINT);
    expect(ctx.gpxCalls).toHaveLength(0);
    expect(ctx.photoCalls).toHaveLength(0);
  });

  it('選擇檔案走同一個分流', () => {
    const input = ctx.container.querySelector<HTMLInputElement>('#fileInput')!;
    Object.defineProperty(input, 'files', { value: [gpxFile('a.gpx'), photoFile('b.heic')] });
    input.dispatchEvent(new Event('change', { bubbles: true }));
    expect(ctx.gpxCalls[0].map((f) => f.name)).toEqual(['a.gpx']);
    expect(ctx.photoCalls[0].map((f) => f.name)).toEqual(['b.heic']);
  });

  it('accept 屬性、aria-label 與隱私說明涵蓋照片', () => {
    const input = ctx.container.querySelector<HTMLInputElement>('#fileInput')!;
    expect(input.accept).toBe(ACCEPT);
    expect(ctx.container.querySelector('#dropzone')!.getAttribute('aria-label')).toContain('照片');
    expect(ctx.container.querySelector('.privacy-note')!.textContent).toBe(PRIVACY_NOTE);
  });
});
