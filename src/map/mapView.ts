import * as maplibregl from 'maplibre-gl';
import type { ExpressionSpecification, GeoJSONSource } from 'maplibre-gl';
import { tokens } from '../styles/tokens';
import type { Day } from '../core/types';
import { computeBounds } from '../core/geo';
import { getBasemap } from './basemaps';

const SOURCE_ID = 'tracks';
const CASING_LAYER_ID = 'tracks-casing';
const TRACKS_LAYER_ID = 'tracks-colored';

export interface MapView {
  setDays(days: Day[]): void;
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

export function colorMatchExpression(days: Day[]): maplibregl.ExpressionSpecification | string {
  if (days.length === 0) return '#000000';
  const expr: unknown[] = ['match', ['get', 'dayIndex']];
  for (const day of days) {
    expr.push(day.dayIndex, day.color);
  }
  expr.push('#000000');
  return expr as maplibregl.ExpressionSpecification;
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
    fitToDays();
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
  }

  function fitToDays() {
    const all = currentDays.flatMap((d) => d.segments.flat());
    if (all.length === 0) {
      map.flyTo({ center: DEFAULT_CENTER, zoom: DEFAULT_ZOOM });
      return;
    }
    const b = computeBounds(all);
    if (!b) return;
    map.fitBounds(
      [
        [b.minLon, b.minLat],
        [b.maxLon, b.maxLat],
      ],
      { padding: 48, duration: 400 },
    );
  }

  syncSoon();

  return {
    setDays(days: Day[]) {
      currentDays = days;
      syncSoon();
    },
    remove() {
      map.remove();
    },
  };
}
