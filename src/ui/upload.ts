import type { AppState } from '../state';

export function mountUpload(container: HTMLElement, state: AppState) {
  container.innerHTML = `
    <div class="dropzone" id="dropzone" tabindex="0" role="button" aria-label="上傳 GPX 檔案">
      <p><strong>拖放 .gpx 檔案到這裡</strong>，或 <button type="button" class="btn-secondary" id="pickBtn">選擇檔案</button></p>
      <input type="file" id="fileInput" accept=".gpx" multiple hidden />
      <p class="privacy-note">軌跡檔案不會上傳；顯示地圖時，底圖服務會得知你正在瀏覽的地區。</p>
    </div>`;
  const input = container.querySelector<HTMLInputElement>('#fileInput')!;
  const pick = container.querySelector<HTMLButtonElement>('#pickBtn')!;
  const zone = container.querySelector<HTMLDivElement>('#dropzone')!;

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
      void state.addFiles([...input.files]);
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
    const files = [...(e.dataTransfer?.files ?? [])].filter((f) => /\.gpx$/i.test(f.name));
    if (files.length > 0) void state.addFiles(files);
  });
}
