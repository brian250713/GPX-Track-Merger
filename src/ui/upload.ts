import { classifyFile } from '../core/photoMeta';
import type { AppState } from '../state';

export const ACCEPT = '.gpx,.jpg,.jpeg,.heic,.heif';
export const UNSUPPORTED_HINT = '只接受 .gpx 與 JPEG／HEIC 照片';
export const PRIVACY_NOTE =
  '軌跡檔案與照片不會上傳，照片只讀取位置與拍攝時間、不會保留；顯示地圖時，底圖服務會得知你正在瀏覽的地區。';

export function mountUpload(container: HTMLElement, state: AppState) {
  container.innerHTML = `
    <div class="dropzone" id="dropzone" tabindex="0" role="button" aria-label="上傳 GPX 與照片">
      <p><strong>拖放 .gpx 與照片到這裡</strong>，或 <button type="button" class="btn-secondary" id="pickBtn">選擇檔案</button></p>
      <input type="file" id="fileInput" accept="${ACCEPT}" multiple hidden />
      <p class="privacy-note">${PRIVACY_NOTE}</p>
      <p class="hint" id="uploadMsg" role="status"></p>
    </div>`;
  const input = container.querySelector<HTMLInputElement>('#fileInput')!;
  const pick = container.querySelector<HTMLButtonElement>('#pickBtn')!;
  const zone = container.querySelector<HTMLDivElement>('#dropzone')!;
  const msg = container.querySelector<HTMLParagraphElement>('#uploadMsg')!;

  function handleFiles(files: File[]) {
    const gpx: File[] = [];
    const photos: File[] = [];
    let unsupported = 0;
    for (const file of files) {
      const kind = classifyFile(file.name);
      if (kind === 'gpx') gpx.push(file);
      else if (kind === 'photo') photos.push(file);
      else unsupported += 1;
    }
    msg.textContent = unsupported > 0 ? UNSUPPORTED_HINT : '';
    if (gpx.length > 0) void state.addFiles(gpx);
    if (photos.length > 0) void state.addPhotos(photos);
  }

  pick.addEventListener('click', (e) => {
    e.stopPropagation();
    input.click();
  });
  zone.addEventListener('click', () => input.click());
  zone.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      input.click();
    }
  });
  input.addEventListener('change', () => {
    if (input.files) {
      handleFiles([...input.files]);
      input.value = '';
    }
  });
  for (const evt of ['dragover', 'dragenter']) {
    zone.addEventListener(evt, (e) => {
      e.preventDefault();
      zone.classList.add('dragging');
    });
  }
  for (const evt of ['dragleave', 'drop']) {
    zone.addEventListener(evt, (e) => {
      e.preventDefault();
      zone.classList.remove('dragging');
    });
  }
  zone.addEventListener('drop', (e) => {
    handleFiles([...(e.dataTransfer?.files ?? [])]);
  });
}
