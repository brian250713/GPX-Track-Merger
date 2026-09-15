import * as maplibregl from 'maplibre-gl';
import type { GeoJSONSource } from 'maplibre-gl';
import { tokens } from '../styles/tokens';
import type { Day, PhotoPin } from '../core/types';
import { computeBounds } from '../core/geo';
import { formatTakenAt } from '../core/photoMeta';
import { getBasemap } from './basemaps';

const SOURCE_ID = 'tracks';
const CASING_LAYER_ID = 'tracks-casing';
const TRACKS_LAYER_ID = 'tracks-colored';

const PHOTOS_SOURCE_ID = 'photos';
const PHOTOS_HIT_LAYER_ID = 'photos-hit';
const PHOTOS_CLUSTER_RADIUS = 50;
// clusterMaxZoom must stay below the source maxzoom (MapLibre requirement).
// 21/22 keeps identically-located photos clustered at max zoom, where a click
// shows the photo list popup instead of unreachable stacked pins (D6).
const PHOTOS_CLUSTER_MAX_ZOOM = 21;
const PHOTOS_SOURCE_MAXZOOM = 22;
const MAX_CLUSTER_LEAVES = 50;
// Big clusters only expand by a zoom level or two, where a sample's center is close enough.
const LEAVES_FOR_CENTER = 1000;

export interface MapView {
  setContent(days: Day[], photos: PhotoPin[]): void;
  remove(): void;
}

function daysToGeoJSON(days: Day[]): GeoJSON.FeatureCollection<GeoJSON.LineString> {
  const features: GeoJSON.Feature<GeoJSON.LineString>[] = [];
  for (const day of days) {
    for (const seg of day.segments) {
      if (seg.length < 2) continue; // single-point segments are not drawn
      features.push({
        type: 'Feature',
        properties: { dayIndex: day.dayIndex, color: day.color },
        geometry: {
          type: 'LineString',
          coordinates: seg.map((p) => [p.lon, p.lat]),
        },
      });
    }
  }
  return { type: 'FeatureCollection', features };
}

export interface PhotoPointProps {
  id: string;
  name: string;
  takenAt?: string;
}

export function photosToGeoJSON(photos: PhotoPin[]): GeoJSON.FeatureCollection<GeoJSON.Point, PhotoPointProps> {
  return {
    type: 'FeatureCollection',
    features: photos.map((p) => ({
      type: 'Feature',
      properties: {
        id: p.id,
        name: p.name,
        ...(p.takenAt ? { takenAt: p.takenAt } : {}),
      },
      geometry: { type: 'Point', coordinates: [p.lon, p.lat] },
    })),
  };
}

/** Union bounds of all track points and photo pins (track-map-view auto-fit). */
export function contentBounds(days: Day[], photos: PhotoPin[]) {
  const all = days.flatMap((d) => d.segments.flat());
  const asPoints = all.concat(
    photos.map((p) => ({ lat: p.lat, lon: p.lon, time: new Date(0) })),
  );
  return computeBounds(asPoints);
}

/** D9: only refit when the content arrays actually changed (by reference). */
export function shouldRefit(
  prevDays: Day[],
  prevPhotos: PhotoPin[],
  nextDays: Day[],
  nextPhotos: PhotoPin[],
): boolean {
  return prevDays !== nextDays || prevPhotos !== nextPhotos;
}

/** Map hint per track-map-view spec (photo count appended when > 0). */
export function mapHintText(dayCount: number, totalKm: number, photoCount: number): string {
  if (dayCount === 0 && photoCount === 0) return '上傳 GPX 或照片開始';
  if (dayCount === 0) return `${photoCount} 張照片`;
  const base = `${dayCount} 天 · ${totalKm.toFixed(1)} km`;
  return photoCount > 0 ? `${base} · ${photoCount} 張照片` : base;
}

export function colorMatchExpression(days: Day[]): maplibregl.ExpressionSpecification | string {
  if (days.length === 0) return '#000000';
  const expr: unknown[] = ['match', ['get', 'dayIndex']];
  for (const day of days) {
    expr.push(day.dayIndex, day.color);
  }
  expr.push('#000000');
  return expr as maplibregl.ExpressionSpecification;
}

export function clusterLabel(count: number): string {
  return count > 999 ? '999+' : String(count);
}

export function clusterSizeClass(count: number): string {
  if (count < 10) return 'photo-cluster--sm';
  if (count < 100) return 'photo-cluster--md';
  return 'photo-cluster--lg';
}

/**
 * D6: identically-located photos expand at clusterMaxZoom + 1, which equals
 * the map's max zoom, so the list must be chosen against clusterMaxZoom.
 */
export function clusterClickAction(expansionZoom: number): 'zoom' | 'list' {
  return expansionZoom > PHOTOS_CLUSTER_MAX_ZOOM ? 'list' : 'zoom';
}

/**
 * Center of the leaves' original coordinates. Cluster positions from
 * querySourceFeatures are snapped to the tile grid at low zoom (sub-pixel
 * there, but tens of metres off once zoomed in), so never zoom to those.
 */
export function leavesCenter(leaves: Array<{ geometry: GeoJSON.Geometry }>): [number, number] | null {
  let minLon = Infinity;
  let minLat = Infinity;
  let maxLon = -Infinity;
  let maxLat = -Infinity;
  for (const leaf of leaves) {
    if (leaf.geometry.type !== 'Point') continue;
    const [lon, lat] = leaf.geometry.coordinates;
    minLon = Math.min(minLon, lon);
    maxLon = Math.max(maxLon, lon);
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
  }
  if (minLon === Infinity) return null;
  return [(minLon + maxLon) / 2, (minLat + maxLat) / 2];
}

/** Keyboard focus: pan when a marker sits outside (or within 24px of) the map's edge. */
export function needsPanIntoView(point: { x: number; y: number }, width: number, height: number): boolean {
  const margin = 24;
  return point.x < margin || point.y < margin || point.x > width - margin || point.y > height - margin;
}

export interface LeafRow {
  name: string;
  takenAt?: string;
}

/** Sort by takenAt ascending; photos without time go last (stable). */
export function sortLeavesByTakenAt(rows: LeafRow[]): LeafRow[] {
  return [...rows].sort((a, b) => {
    if (a.takenAt && b.takenAt) return a.takenAt < b.takenAt ? -1 : a.takenAt > b.takenAt ? 1 : 0;
    if (a.takenAt) return -1;
    if (b.takenAt) return 1;
    return 0;
  });
}

/**
 * Marker roots are plain wrappers: MapLibre owns the root's className
 * (`maplibregl-marker`, position:absolute) and inline transform, so button
 * styling and hover offsets live on the inner button and never clobber them.
 * Clicks stop at the button: a map `click` would close the popup it just opened.
 */
function markerRoot(doc: Document, button: HTMLButtonElement, onClick: () => void): HTMLElement {
  button.type = 'button';
  button.addEventListener('click', (e) => {
    e.stopPropagation();
    onClick();
  });
  const root = doc.createElement('div');
  root.append(button);
  return root;
}

export function createClusterMarkerElement(doc: Document, count: number, onClick: () => void): HTMLElement {
  const root = markerRoot(doc, doc.createElement('button'), onClick);
  updateClusterMarkerElement(root, count);
  return root;
}

export function updateClusterMarkerElement(root: HTMLElement, count: number) {
  const btn = root.querySelector('button');
  if (!btn) return;
  btn.className = `photo-cluster ${clusterSizeClass(count)}`;
  btn.setAttribute('aria-label', `${count} 張照片`);
  btn.textContent = clusterLabel(count);
}

export function createPinMarkerElement(doc: Document, name: string, onClick: () => void): HTMLElement {
  const btn = doc.createElement('button');
  btn.className = 'photo-pin';
  btn.setAttribute('aria-label', `照片 ${name}`);
  return markerRoot(doc, btn, onClick);
}

function takenAtDisplay(takenAt?: string): string {
  return formatTakenAt(takenAt) ?? '沒有拍攝時間';
}

/** Single-pin popup content. Filename is set via textContent (never HTML). */
export function buildPhotoPopupContent(doc: Document, pin: { name: string; takenAt?: string }): HTMLElement {
  const wrap = doc.createElement('div');
  wrap.className = 'photo-popup';
  const name = doc.createElement('div');
  name.className = 'photo-popup__name';
  name.textContent = pin.name;
  const time = doc.createElement('div');
  time.className = 'photo-popup__time';
  time.textContent = takenAtDisplay(pin.takenAt);
  wrap.append(name, time);
  return wrap;
}

/** Same-location cluster list popup (max 50 rows +「還有 N 張」). */
export function buildLeavesPopupContent(doc: Document, rows: LeafRow[], total: number): HTMLElement {
  const wrap = doc.createElement('div');
  wrap.className = 'photo-popup photo-popup--list';
  const list = doc.createElement('ul');
  for (const row of rows) {
    const li = doc.createElement('li');
    const name = doc.createElement('span');
    name.className = 'photo-popup__name';
    name.textContent = row.name;
    const time = doc.createElement('span');
    time.className = 'photo-popup__time';
    time.textContent = takenAtDisplay(row.takenAt);
    li.append(name, ' ', time);
    list.append(li);
  }
  wrap.append(list);
  if (total > rows.length) {
    const more = doc.createElement('div');
    more.className = 'photo-popup__more';
    more.textContent = `還有 ${total - rows.length} 張`;
    wrap.append(more);
  }
  return wrap;
}

const DEFAULT_CENTER: [number, number] = [121.5654, 25.033];
const DEFAULT_ZOOM = 10;

export function createMapView(container: HTMLElement, basemapId: string): MapView {
  const basemap = getBasemap(basemapId);
  const map = new maplibregl.Map({
    container,
    style: basemap.style,
    center: DEFAULT_CENTER,
    zoom: DEFAULT_ZOOM,
    attributionControl: { compact: true },
  });
  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');

  let currentDays: Day[] = [];
  let currentPhotos: PhotoPin[] = [];
  let fittedDays: Day[] | null = null;
  let fittedPhotos: PhotoPin[] | null = null;
  const markers = new Map<string, maplibregl.Marker>();
  let photoById = new Map<string, PhotoPin>();
  let photoByIdSource: PhotoPin[] | null = null;
  const clusterInfo = new Map<string, { clusterId: number; lngLat: [number, number]; count: number }>();
  let photoPopup: maplibregl.Popup | null = null;

  // Sync layers + camera. Safe to call any time:
  // - addSource/addLayer/setData only need the style JSON parsed
  //   (style._loaded), NOT fully-loaded tiles.
  // - map.loaded()/isStyleLoaded()/once('load') all wait for every tile,
  //   so gating on them loses the update forever when tiles hang
  //   (uploaded tracks would never appear, with no error).
  function syncNow(): boolean {
    if (!map.getStyle()) return false;
    try {
      ensureLayers();
    } catch (e) {
      if (e instanceof Error && /not done loading/i.test(e.message)) return false;
      throw e;
    }
    if (fittedDays !== currentDays || fittedPhotos !== currentPhotos) {
      fittedDays = currentDays;
      fittedPhotos = currentPhotos;
      fitToContent();
    }
    syncPhotoMarkers();
    return true;
  }

  function syncSoon() {
    if (!syncNow()) map.once('style.load', () => void syncNow());
  }

  function ensureLayers() {
    const source = map.getSource(SOURCE_ID) as GeoJSONSource | undefined;
    const data = daysToGeoJSON(currentDays);
    if (!source) {
      map.addSource(SOURCE_ID, { type: 'geojson', data });
      map.addLayer({
        id: CASING_LAYER_ID,
        type: 'line',
        source: SOURCE_ID,
        paint: {
          'line-color': tokens.text,
          'line-width': 7,
          'line-opacity': 0.95,
        },
      });
      map.addLayer({
        id: TRACKS_LAYER_ID,
        type: 'line',
        source: SOURCE_ID,
        paint: {
          'line-color': colorMatchExpression(currentDays),
          'line-width': 4,
          'line-opacity': 1,
        },
      });
    } else {
      void source.setData(data);
      if (map.getLayer(TRACKS_LAYER_ID)) {
        map.setPaintProperty(TRACKS_LAYER_ID, 'line-color', colorMatchExpression(currentDays));
      }
    }

    const photoSource = map.getSource(PHOTOS_SOURCE_ID) as GeoJSONSource | undefined;
    const photoData = photosToGeoJSON(currentPhotos);
    if (!photoSource) {
      map.addSource(PHOTOS_SOURCE_ID, {
        type: 'geojson',
        data: photoData,
        cluster: true,
        clusterRadius: PHOTOS_CLUSTER_RADIUS,
        clusterMaxZoom: PHOTOS_CLUSTER_MAX_ZOOM,
        maxzoom: PHOTOS_SOURCE_MAXZOOM,
      });
      // Transparent layer keeps the clustered source queryable/rendered
      // without drawing anything itself (markers are HTML buttons, D5).
      map.addLayer({
        id: PHOTOS_HIT_LAYER_ID,
        type: 'circle',
        source: PHOTOS_SOURCE_ID,
        paint: { 'circle-radius': 12, 'circle-opacity': 0 },
      });
    } else {
      void photoSource.setData(photoData);
    }
  }

  function fitToContent() {
    const b = contentBounds(currentDays, currentPhotos);
    if (!b) {
      map.flyTo({ center: DEFAULT_CENTER, zoom: DEFAULT_ZOOM });
      return;
    }
    map.fitBounds(
      [
        [b.minLon, b.minLat],
        [b.maxLon, b.maxLat],
      ],
      { padding: 48, duration: 400 },
    );
  }

  function openPopup(lngLat: maplibregl.LngLatLike, el: HTMLElement) {
    photoPopup?.remove();
    photoPopup = new maplibregl.Popup({ closeButton: true, maxWidth: '280px' })
      .setLngLat(lngLat)
      .setDOMContent(el)
      .addTo(map);
  }

  function showClusterLeaves(clusterId: number, lngLat: maplibregl.LngLatLike, total: number) {
    const source = map.getSource(PHOTOS_SOURCE_ID) as GeoJSONSource | undefined;
    if (!source) return;
    void source.getClusterLeaves(clusterId, MAX_CLUSTER_LEAVES, 0).then(
      (leaves) => {
        const at = leavesCenter(leaves) ?? lngLat;
        const rows = sortLeavesByTakenAt(
          leaves.map((f) => {
            const p = (f.properties ?? {}) as { name?: unknown; takenAt?: unknown };
            return {
              name: typeof p.name === 'string' ? p.name : '',
              takenAt: typeof p.takenAt === 'string' ? p.takenAt : undefined,
            };
          }),
        );
        openPopup(at, buildLeavesPopupContent(document, rows, total));
      },
      () => {},
    );
  }

  function onClusterClick(clusterId: number, lngLat: maplibregl.LngLatLike, total: number) {
    const source = map.getSource(PHOTOS_SOURCE_ID) as GeoJSONSource | undefined;
    if (!source) return;
    void source.getClusterExpansionZoom(clusterId).then(
      (zoom) => {
        if (clusterClickAction(zoom) === 'list') {
          showClusterLeaves(clusterId, lngLat, total);
          return;
        }
        void source.getClusterLeaves(clusterId, LEAVES_FOR_CENTER, 0).then(
          (leaves) => zoomTo(leavesCenter(leaves) ?? lngLat, zoom),
          () => zoomTo(lngLat, zoom),
        );
      },
      () => showClusterLeaves(clusterId, lngLat, total),
    );
  }

  function prefersReducedMotion(): boolean {
    return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  }

  function zoomTo(center: maplibregl.LngLatLike, zoom: number) {
    map.easeTo({ center, zoom, duration: prefersReducedMotion() ? 0 : 400 });
  }

  function markerKey(props: Record<string, unknown>): string | null {
    if (props['cluster'] === true) {
      return typeof props['cluster_id'] === 'number' ? `c${props['cluster_id'] as number}` : null;
    }
    return typeof props['id'] === 'string' ? `p${props['id']}` : null;
  }

  function syncPhotoMarkers() {
    if (photoByIdSource !== currentPhotos) {
      photoByIdSource = currentPhotos;
      photoById = new Map(currentPhotos.map((p) => [p.id, p]));
    }
    let features: Array<GeoJSON.Feature<GeoJSON.Point>>;
    try {
      features = map.querySourceFeatures(PHOTOS_SOURCE_ID) as Array<GeoJSON.Feature<GeoJSON.Point>>;
    } catch {
      return; // source not ready yet; sourcedata/moveend will retry
    }
    const seen = new Set<string>();
    for (const feature of features) {
      const props = (feature.properties ?? {}) as Record<string, unknown>;
      const key = markerKey(props);
      if (!key || seen.has(key)) continue; // same feature can repeat across tiles
      seen.add(key);
      const coords = feature.geometry?.coordinates;
      if (!Array.isArray(coords) || coords.length < 2) continue;
      let lngLat: [number, number] = [coords[0] as number, coords[1] as number];
      if (props['cluster'] === true) {
        const clusterId = props['cluster_id'] as number;
        const count = typeof props['point_count'] === 'number' ? (props['point_count'] as number) : 0;
        // cluster_id can be reused after setData, so the click reads current values.
        clusterInfo.set(key, { clusterId, lngLat, count });
        let marker = markers.get(key);
        if (!marker) {
          const el = createClusterMarkerElement(document, count, () => {
            const info = clusterInfo.get(key);
            if (info) onClusterClick(info.clusterId, info.lngLat, info.count);
          });
          marker = new maplibregl.Marker({ element: el }).setLngLat(lngLat);
          marker.addTo(map);
          markers.set(key, marker);
        } else {
          marker.setLngLat(lngLat);
          updateClusterMarkerElement(marker.getElement(), count);
        }
      } else {
        const name = typeof props['name'] === 'string' ? props['name'] : '';
        const takenAt = typeof props['takenAt'] === 'string' ? (props['takenAt'] as string) : undefined;
        // Tile coordinates are grid-snapped at low zoom; pins use the photo's own position.
        const photo = photoById.get(props['id'] as string);
        if (photo) lngLat = [photo.lon, photo.lat];
        let marker = markers.get(key);
        if (!marker) {
          const pin = { name, takenAt };
          const at = lngLat;
          const el = createPinMarkerElement(document, name, () => {
            openPopup(at, buildPhotoPopupContent(document, pin));
          });
          marker = new maplibregl.Marker({ element: el }).setLngLat(lngLat);
          marker.addTo(map);
          markers.set(key, marker);
        } else {
          marker.setLngLat(lngLat);
        }
      }
    }
    for (const [key, marker] of markers) {
      if (!seen.has(key)) {
        marker.remove();
        markers.delete(key);
        clusterInfo.delete(key);
      }
    }
  }

  // Tabbing to a marker outside the view makes the browser scroll the
  // overflow:hidden map container, shifting the canvas away from pointer and
  // marker coordinates. Undo that scroll and pan the map to the marker instead.
  const mapEl = map.getContainer();
  mapEl.addEventListener('scroll', () => {
    mapEl.scrollTop = 0;
    mapEl.scrollLeft = 0;
  });
  mapEl.addEventListener('focusin', (e) => {
    const markerEl = (e.target as HTMLElement).closest('.maplibregl-marker');
    if (!markerEl) return;
    const marker = [...markers.values()].find((m) => m.getElement() === markerEl);
    if (!marker) return;
    const lngLat = marker.getLngLat();
    if (needsPanIntoView(map.project(lngLat), mapEl.clientWidth, mapEl.clientHeight)) {
      map.easeTo({ center: lngLat, duration: prefersReducedMotion() ? 0 : 300 });
    }
  });

  // Re-sync on rendered frames once the photo source is loaded (MapLibre's HTML
  // cluster pattern). querySourceFeatures also returns parent-zoom tiles kept
  // while child tiles load/fade, so syncing only on sourcedata/moveend could
  // leave a stale cluster marker next to its split-up children.
  map.on('render', () => {
    if (!map.getSource(PHOTOS_SOURCE_ID) || !map.isSourceLoaded(PHOTOS_SOURCE_ID)) return;
    syncPhotoMarkers();
  });

  syncSoon();

  return {
    setContent(days: Day[], photos: PhotoPin[]) {
      currentDays = days;
      currentPhotos = photos;
      syncSoon();
    },
    remove() {
      map.remove();
    },
  };
}
