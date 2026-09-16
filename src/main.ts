import 'maplibre-gl/dist/maplibre-gl.css';
import { setWorkerUrl } from 'maplibre-gl';
// MapLibre resolves its worker as a sibling of its own module file, which
// doesn't exist once Vite bundles it (dev: .vite/deps, build: assets/).
// Without a worker, GeoJSON sources never render (tracks invisible, no error).
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import '@fontsource-variable/fredoka';
import '@fontsource-variable/nunito';
import '@fontsource-variable/chiron-goround-tc';
import './styles/tokens.css';
import './styles/components.css';
import { createMapView, mapHintText } from './map/mapView';
import { AppState } from './state';
import { mountUpload } from './ui/upload';
import { mountFileList } from './ui/fileList';
import { mountPhotoSummary } from './ui/photoSummary';
import { mountTimezone } from './ui/timezone';
import { mountSummary, mountStats } from './ui/summary';
import { mountControls } from './ui/controls';

setWorkerUrl(maplibreWorkerUrl);

const state = new AppState();

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <div class="bento">
    <header class="clay-card area-header">
      <h1>GPX 旅行軌跡合併</h1>
      <div id="tzBox"></div>
    </header>
    <section class="clay-card area-upload" aria-label="上傳"><h2>上傳</h2><div id="uploadBox"></div></section>
    <section class="clay-card area-map" aria-label="地圖"><h2>地圖</h2><div id="map"></div><p class="hint" id="mapHint">上傳 GPX 或照片開始</p></section>
    <section class="clay-card area-files" aria-label="檔案"><h2>檔案</h2><div id="fileBox"></div><div id="photoBox"></div></section>
    <section class="clay-card area-stats" aria-label="統計"><h2>統計</h2><div id="statsBox"></div></section>
    <section class="clay-card area-summary" aria-label="分天摘要"><h2>分天摘要</h2><div id="summaryBox"></div></section>
    <section class="clay-card area-export" aria-label="匯出"><h2>匯出</h2><div id="controlsBox"></div></section>
  </div>`;

mountTimezone(document.getElementById('tzBox')!, state);
mountUpload(document.getElementById('uploadBox')!, state);
mountFileList(document.getElementById('fileBox')!, state);
mountPhotoSummary(document.getElementById('photoBox')!, state, document.getElementById('fileBox')!);
mountSummary(document.getElementById('summaryBox')!, state);
mountStats(document.getElementById('statsBox')!, state);
mountControls(document.getElementById('controlsBox')!, state);

const mapView = createMapView(document.getElementById('map')!, 'osm-standard');
state.subscribe(() => {
  mapView.setContent(state.days, state.photos);
  const hint = document.getElementById('mapHint')!;
  hint.textContent = mapHintText(state.days.length, state.totalKm, state.photos.length);
});
