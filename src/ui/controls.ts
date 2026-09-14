import { buildGpx, gpxFileName } from '../core/gpxWriter';
import { getBasemap } from '../map/basemaps';
import type { AppState } from '../state';
import { renderTripCard } from '../card/renderCard';
import { downloadBlob } from './download';

export function mountControls(container: HTMLElement, state: AppState) {
  container.innerHTML = `
    <label for="titleInput">標題</label>
    <input id="titleInput" type="text" placeholder="例如：京都・大阪 5 日" maxlength="80" />
    <fieldset class="style-picker">
      <legend>圖卡風格</legend>
      <label><input type="radio" name="cardStyle" value="with-basemap" checked /> 含底圖</label>
      <label><input type="radio" name="cardStyle" value="minimal" /> 極簡</label>
      <span id="basemapNote" class="hint"></span>
    </fieldset>
    <div class="btn-row">
      <button type="button" id="exportGpx" class="btn-primary">匯出 GPX</button>
      <button type="button" id="downloadCard" class="btn-primary">下載圖卡</button>
    </div>
    <p id="actionMsg" class="hint" role="status"></p>`;

  const titleInput = container.querySelector<HTMLInputElement>('#titleInput')!;
  const exportBtn = container.querySelector<HTMLButtonElement>('#exportGpx')!;
  const cardBtn = container.querySelector<HTMLButtonElement>('#downloadCard')!;
  const msg = container.querySelector<HTMLParagraphElement>('#actionMsg')!;
  const note = container.querySelector<HTMLSpanElement>('#basemapNote')!;
  const radios = [...container.querySelectorAll<HTMLInputElement>('input[name="cardStyle"]')];

  const basemap = getBasemap('osm-standard');
  if (!basemap.exportable) {
    radios.find((r) => r.value === 'with-basemap')!.disabled = true;
    note.textContent = basemap.exportNote ?? '目前底圖不可匯出';
  }

  titleInput.addEventListener('input', () => state.setTitle(titleInput.value));
  radios.forEach((r) =>
    r.addEventListener('change', () => {
      if (r.checked) state.setCardStyle(r.value as AppState['cardStyle']);
    }),
  );

  function refresh() {
    const hasData = state.days.length > 0;
    exportBtn.disabled = !hasData;
    cardBtn.disabled = !hasData;
  }
  state.subscribe(refresh);
  refresh();

  exportBtn.addEventListener('click', () => {
    if (state.days.length === 0) return;
    const xml = buildGpx(state.days, state.title);
    const first = state.days[0].date;
    downloadBlob(new Blob([xml], { type: 'application/gpx+xml' }), gpxFileName(state.title, first));
  });

  cardBtn.addEventListener('click', async () => {
    if (state.days.length === 0) return;
    cardBtn.disabled = true;
    const original = cardBtn.textContent;
    cardBtn.textContent = '產生中…';
    msg.textContent = '';
    try {
      const blob = await renderTripCard({
        days: state.days,
        title: state.title,
        totalKm: state.totalKm,
        style: state.cardStyle,
      });
      const first = state.days[0].date;
      const base = state.title.trim() === '' ? 'trip' : state.title.trim().replace(/[/\\?%*:|"<>]/g, '');
      downloadBlob(blob, `${base}_${first}_${state.cardStyle === 'minimal' ? 'minimal' : 'map'}.png`);
    } catch (err) {
      msg.textContent =
        err instanceof Error ? err.message : '圖卡產生失敗，請改用極簡風格再試一次';
    } finally {
      cardBtn.disabled = state.days.length === 0;
      cardBtn.textContent = original;
    }
  });
}
