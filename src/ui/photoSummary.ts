import type { AppState } from '../state';

/**
 * D10: photo summary lives in the file section below the file list.
 * Hidden until at least one photo has been added; clearing photos hides it again.
 */
export function mountPhotoSummary(container: HTMLElement, state: AppState, focusTarget?: HTMLElement) {
  function render() {
    const pending = state.photoPending;
    const hasPhotos = state.photos.length > 0 || state.photoMissingCount > 0 || pending !== null;
    if (!hasPhotos) {
      container.innerHTML = '';
      return;
    }
    if (pending) {
      container.innerHTML =
        `<p class="photo-summary" role="status">讀取照片中… ${pending.done}／${pending.total}</p>`;
      return;
    }
    container.innerHTML =
      `<p class="photo-summary">照片 ${state.photos.length} 張有位置 · ${state.photoMissingCount} 張沒有位置 ` +
      `<button type="button" class="btn-remove" id="clearPhotosBtn">清除照片</button></p>`;
    container.querySelector<HTMLButtonElement>('#clearPhotosBtn')!.addEventListener('click', () => {
      state.clearPhotos();
      // The button is removed with the summary; keep keyboard users in place
      // by moving focus to the file section container (D10).
      (focusTarget ?? container).focus();
    });
  }
  state.subscribe(render);
  render();
}
