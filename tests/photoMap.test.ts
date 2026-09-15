import { describe, expect, it } from 'vitest';
import {
  buildLeavesPopupContent,
  buildPhotoPopupContent,
  clusterClickAction,
  clusterLabel,
  clusterSizeClass,
  createClusterMarkerElement,
  createPinMarkerElement,
  updateClusterMarkerElement,
  contentBounds,
  leavesCenter,
  needsPanIntoView,
  mapHintText,
  photosToGeoJSON,
  shouldRefit,
  sortLeavesByTakenAt,
} from '../src/map/mapView';
import type { Day, PhotoPin } from '../src/core/types';
import type { TrackPoint } from '../src/core/types';

const pt = (lat: number, lon: number): TrackPoint => ({ lat, lon, time: new Date('2026-03-12T00:00:00Z') });
const day = (pts: TrackPoint[]): Day => ({
  dayIndex: 1,
  date: '2026-03-12',
  color: '#E53935',
  segments: [pts],
  distanceKm: 1,
});
const pin = (id: string, lat: number, lon: number, takenAt?: string): PhotoPin => ({
  id,
  name: `${id}.jpg`,
  lat,
  lon,
  ...(takenAt ? { takenAt } : {}),
});

describe('setContent refit gating', () => {
  it('只改標題（參照不變）時不重新縮放', () => {
    const days = [day([pt(25, 121), pt(25.01, 121.01)])];
    const photos = [pin('p1', 25.02, 121.02)];
    expect(shouldRefit(days, photos, days, photos)).toBe(false);
  });

  it('days 或 photos 參照改變時重新縮放', () => {
    const days = [day([pt(25, 121), pt(25.01, 121.01)])];
    const photos = [pin('p1', 25.02, 121.02)];
    expect(shouldRefit(days, photos, [...days], photos)).toBe(true);
    expect(shouldRefit(days, photos, days, [...photos])).toBe(true);
  });
});

describe('bounds 聯集', () => {
  it('範圍取軌跡點與照片座標的聯集', () => {
    const b = contentBounds([day([pt(25, 121), pt(25.01, 121.01)])], [pin('p1', 24.5, 122)]);
    expect(b).toEqual({ minLat: 24.5, minLon: 121, maxLat: 25.01, maxLon: 122 });
  });

  it('只有照片時也有範圍', () => {
    const b = contentBounds([], [pin('p1', 35, 135), pin('p2', 35.1, 135.1)]);
    expect(b).toEqual({ minLat: 35, minLon: 135, maxLat: 35.1, maxLon: 135.1 });
  });

  it('都沒有時回傳 null', () => {
    expect(contentBounds([], [])).toBeNull();
  });
});

describe('photos GeoJSON', () => {
  it('保留 id／檔名／拍攝時間供 marker 與 popup 使用', () => {
    const fc = photosToGeoJSON([pin('p1', 35, 135, '2026-03-12T14:05:33')]);
    expect(fc.features).toHaveLength(1);
    expect(fc.features[0].geometry.coordinates).toEqual([135, 35]);
    expect(fc.features[0].properties).toEqual({
      id: 'p1',
      name: 'p1.jpg',
      takenAt: '2026-03-12T14:05:33',
    });
  });
});

describe('popup 純文字', () => {
  it('檔名含 HTML 字元時以純文字顯示', () => {
    const el = buildPhotoPopupContent(document, { name: '<b>test</b>.jpg', takenAt: '2026-03-12T14:05:33' });
    expect(el.querySelector('.photo-popup__name')!.textContent).toBe('<b>test</b>.jpg');
    expect(el.querySelector('.photo-popup__name')!.innerHTML).not.toContain('<b>');
    expect(el.querySelector('.photo-popup__time')!.textContent).toBe('2026.03.12 14:05');
  });

  it('沒有拍攝時間時顯示「沒有拍攝時間」', () => {
    const el = buildPhotoPopupContent(document, { name: 'a.jpg' });
    expect(el.querySelector('.photo-popup__time')!.textContent).toBe('沒有拍攝時間');
  });

  it('同一位置清單依拍攝時間排序、超過 50 張顯示「還有 N 張」', () => {
    const rows = sortLeavesByTakenAt([
      { name: 'b.jpg', takenAt: '2026-03-12T15:00:00' },
      { name: 'c.jpg' },
      { name: 'a.jpg', takenAt: '2026-03-12T14:00:00' },
    ]);
    expect(rows.map((r) => r.name)).toEqual(['a.jpg', 'b.jpg', 'c.jpg']);
    const many = Array.from({ length: 50 }, (_, i) => ({ name: `${i}.jpg` }));
    const el = buildLeavesPopupContent(document, many, 55);
    expect(el.querySelectorAll('li')).toHaveLength(50);
    expect(el.querySelector('.photo-popup__more')!.textContent).toBe('還有 5 張');
  });
});

describe('cluster 標籤', () => {
  it('999 以上顯示 999+，三級大小', () => {
    expect(clusterLabel(12)).toBe('12');
    expect(clusterLabel(1200)).toBe('999+');
    expect(clusterSizeClass(5)).toContain('sm');
    expect(clusterSizeClass(12)).toContain('md');
    expect(clusterSizeClass(200)).toContain('lg');
  });
});

describe('marker 元素', () => {
  // MapLibre 會在 marker 根元素加上 maplibregl-marker（position:absolute）與 inline transform；
  // 更新 cluster 時若覆寫根元素 className，數字圈會失去定位而跑出地圖外。
  it('更新 cluster 數量時不動 MapLibre 加在根元素上的 class', () => {
    const root = createClusterMarkerElement(document, 3, () => {});
    root.classList.add('maplibregl-marker', 'maplibregl-marker-anchor-center');
    updateClusterMarkerElement(root, 120);
    expect(root.classList.contains('maplibregl-marker')).toBe(true);
    expect(root.classList.contains('maplibregl-marker-anchor-center')).toBe(true);
    const btn = root.querySelector('button')!;
    expect(btn.classList.contains('photo-cluster')).toBe(true);
    expect(btn.className).toContain('lg');
    expect(btn.textContent).toBe('120');
    expect(btn.getAttribute('aria-label')).toBe('120 張照片');
  });

  it('樣式與 hover 位移放在內層按鈕，不與 MapLibre 的 transform 衝突', () => {
    const cluster = createClusterMarkerElement(document, 3, () => {});
    const pinEl = createPinMarkerElement(document, 'a.jpg', () => {});
    for (const root of [cluster, pinEl]) {
      expect(root.tagName).not.toBe('BUTTON');
      expect(root.className).not.toMatch(/photo-(pin|cluster)/);
    }
    expect(pinEl.querySelector('button.photo-pin')!.getAttribute('aria-label')).toBe('照片 a.jpg');
  });

  it('點擊內層按鈕觸發 callback，且不冒泡到地圖（否則剛開的 popup 會被地圖 click 關掉）', () => {
    const mapContainer = document.createElement('div');
    let mapClicks = 0;
    mapContainer.addEventListener('click', () => (mapClicks += 1));
    let clicks = 0;
    const pinRoot = createPinMarkerElement(document, 'a.jpg', () => (clicks += 1));
    const clusterRoot = createClusterMarkerElement(document, 3, () => (clicks += 1));
    mapContainer.append(pinRoot, clusterRoot);
    pinRoot.querySelector('button')!.click();
    clusterRoot.querySelector('button')!.click();
    expect(clicks).toBe(2);
    expect(mapClicks).toBe(0);
  });
});

describe('點數字圈', () => {
  // 同座標照片的展開層級是 clusterMaxZoom + 1（22），等於地圖 maxZoom；
  // 若以「大於 maxZoom」判斷，清單永遠不會出現，只會放大成疊在一起的圖釘。
  it('展開層級超過 clusterMaxZoom 時顯示清單，否則放大', () => {
    expect(clusterClickAction(22)).toBe('list');
    expect(clusterClickAction(21)).toBe('zoom');
    expect(clusterClickAction(8)).toBe('zoom');
  });

  // querySourceFeatures 在低縮放層級的座標會對齊圖磚格點（京都測試照片偏約 80 公尺），
  // 放大中心要用照片原始座標，否則放到最大層級時照片落在畫面外。
  it('放大中心取照片原始座標範圍的中心', () => {
    const leaf = (lon: number, lat: number) => ({ geometry: { type: 'Point' as const, coordinates: [lon, lat] } });
    expect(leavesCenter([leaf(135.7681, 35.0116), leaf(135.7681, 35.0116)])).toEqual([135.7681, 35.0116]);
    expect(leavesCenter([leaf(120, 22), leaf(122, 24)])).toEqual([121, 23]);
    expect(leavesCenter([])).toBeNull();
  });
});

describe('鍵盤聚焦 marker', () => {
  // 聚焦到畫面邊緣外的 marker 時，瀏覽器會捲動 overflow:hidden 的地圖容器，
  // 讓畫布偏移；改由地圖平移把 marker 帶進畫面。
  it('marker 在畫面外或太靠邊時需要平移，畫面內不需要', () => {
    expect(needsPanIntoView({ x: 400, y: 240 }, 767, 480)).toBe(false);
    expect(needsPanIntoView({ x: 711, y: 502 }, 767, 480)).toBe(true);
    expect(needsPanIntoView({ x: 10, y: 240 }, 767, 480)).toBe(true);
    expect(needsPanIntoView({ x: 400, y: -5 }, 767, 480)).toBe(true);
  });
});

describe('地圖提示三種狀態', () => {
  it('初次開啟／只有照片／軌跡與照片都有', () => {
    expect(mapHintText(0, 0, 0)).toBe('上傳 GPX 或照片開始');
    expect(mapHintText(0, 0, 8)).toBe('8 張照片');
    expect(mapHintText(3, 42.3, 8)).toBe('3 天 · 42.3 km · 8 張照片');
    expect(mapHintText(3, 42.3, 0)).toBe('3 天 · 42.3 km');
  });
});
