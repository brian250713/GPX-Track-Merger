import type { StyleSpecification } from 'maplibre-gl';

export interface Basemap {
  id: string;
  name: string;
  style: StyleSpecification;
  attribution: string;
  exportable: boolean;
  exportNote?: string;
  needsKey?: boolean;
}

/**
 * Spike result (tasks 2.1–2.4, 2026-09):
 * - OSM Standard raster (tile.openstreetmap.org): serves CORS headers
 *   (mod_tile add_cors), canvas export works, no API key needed.
 *   Attribution: © OpenStreetMap contributors. Tile usage policy applies
 *   (identify app, cache, no heavy scraping). -> default, exportable: true.
 * - NLSC (Taiwan): historically no CORS headers on map tiles -> canvas
 *   would be tainted, toBlob throws SecurityError. Marked exportable: false.
 * - MapTiler / Stadia: CORS-enabled, export allowed with attribution, but
 *   every request needs an API key (exposed in frontend; use referrer/domain
 *   restriction). Kept as opt-in alternatives requiring a key.
 */
export const OSM_ATTRIBUTION =
  '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors';

function osmStyle(): StyleSpecification {
  return {
    version: 8,
    sources: {
      osm: {
        type: 'raster',
        tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
        tileSize: 256,
        attribution: OSM_ATTRIBUTION,
        maxzoom: 19,
      },
    },
    layers: [
      {
        id: 'osm-tiles',
        type: 'raster',
        source: 'osm',
      },
    ],
  } as StyleSpecification;
}

export const BASEMAPS: Basemap[] = [
  {
    id: 'osm-standard',
    name: 'OpenStreetMap 標準圖',
    style: osmStyle(),
    attribution: OSM_ATTRIBUTION,
    exportable: true,
  },
  {
    id: 'nlsc-taiwan',
    name: '國土測繪中心 NLSC（台灣通用電子地圖）',
    style: {
      version: 8,
      sources: {
        nlsc: {
          type: 'raster',
          tiles: ['https://wmts.nlsc.gov.tw/wmts/EMAP/default/GoogleMapsCompatible/{z}/{y}/{x}'],
          tileSize: 256,
          attribution: '© 國土測繪中心 NLSC',
          maxzoom: 18,
        },
      },
      layers: [{ id: 'nlsc-tiles', type: 'raster', source: 'nlsc' }],
    } as unknown as StyleSpecification,
    attribution: '© 國土測繪中心 NLSC',
    exportable: false,
    exportNote: 'NLSC 圖磚不支援跨網域匯出，請改用極簡風格或 OSM 底圖',
  },
];

export const DEFAULT_BASEMAP_ID = 'osm-standard';

export function getBasemap(id: string): Basemap {
  return BASEMAPS.find((b) => b.id === id) ?? BASEMAPS[0];
}
