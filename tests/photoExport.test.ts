import { describe, expect, it } from 'vitest';
import { AppState } from '../src/state';
import { mountControls } from '../src/ui/controls';

/** photo-pins「照片不影響分天與匯出」：只有照片時匯出停用，匯出內容不可能含照片. */
describe('photos do not affect export', () => {
  it('只有照片時「匯出 GPX」與「下載圖卡」為停用', async () => {
    document.body.innerHTML = '<div id="controlsBox"></div>';
    const container = document.getElementById('controlsBox')!;
    const state = new AppState();
    mountControls(container, state);
    await state.addPhotos([new File(['x'], 'a.jpg')], async () => ({ lat: 35, lon: 135 }));
    expect(state.photos).toHaveLength(1);
    expect(state.days).toHaveLength(0);
    expect(container.querySelector<HTMLButtonElement>('#exportGpx')!.disabled).toBe(true);
    expect(container.querySelector<HTMLButtonElement>('#downloadCard')!.disabled).toBe(true);
  });
});
