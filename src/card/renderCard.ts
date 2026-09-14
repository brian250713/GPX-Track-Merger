import * as maplibregl from 'maplibre-gl';
import { tokens } from '../styles/tokens';
import type { Day } from '../core/types';
import { computeBounds } from '../core/geo';
import { webMercator } from '../core/geo';
import { getBasemap } from '../map/basemaps';

export const CARD_SIZE = 2160;
const PADDING = 96;
const MAP_RECT = { x: 96, y: 360, w: 1968, h: 1280 };
const BORDER_W = 6;
const RADIUS = 48;
const SHADOW_OFFSET = 12;

export interface RenderOptions {
  days: Day[];
  title: string;
  totalKm: number;
  style: 'with-basemap' | 'minimal';
  basemapId?: string;
}

/** Date range: multi-day `2026.03.12 – 03.16`, single `2026.03.12`, cross-year full. */
export function formatDateRange(firstDate: string, lastDate: string): string {
  const f = (d: string) => d.split('-').join('.');
  if (firstDate === lastDate) return f(firstDate);
  const [fy, fm, fd] = firstDate.split('-');
  const [ly, lm, ld] = lastDate.split('-');
  if (fy !== ly) return `${f(firstDate)} – ${f(lastDate)}`;
  void fy;
  return `${f(firstDate)} – ${lm}.${ld}`;
}

async function ensureCardFonts(title: string) {
  const families = [
    '"Fredoka Variable"',
    '"Nunito Variable"',
    '"Chiron GoRound TC Variable"',
  ];
  const sample = `Day 1234567890. – km天總距離 ${title}`;
  await Promise.allSettled(
    families.flatMap((fam) => [
      document.fonts.load(`700 96px ${fam}`, sample),
      document.fonts.load(`400 48px ${fam}`, sample),
    ]),
  );
  try {
    await Promise.race([
      document.fonts.ready,
      new Promise((res) => setTimeout(res, 2000)),
    ]);
  } catch {
    /* ignore */
  }
}

function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  if (typeof ctx.roundRect === 'function') {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
  } else {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
}

function drawMinimalTracks(
  ctx: CanvasRenderingContext2D,
  days: Day[],
  rect: { x: number; y: number; w: number; h: number },
) {
  const all = days.flatMap((d) => d.segments.flat());
  ctx.save();
  roundRectPath(ctx, rect.x, rect.y, rect.w, rect.h, RADIUS);
  ctx.clip();
  ctx.fillStyle = tokens.secondary;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);

  const bounds = computeBounds(all);
  if (bounds) {
    const pad = 80;
    const pts = all.map((p) => webMercator(p.lat, p.lon));
    const xs = pts.map((p) => p.x);
    const ys = pts.map((p) => p.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const spanX = Math.max(maxX - minX, 1e-9);
    const spanY = Math.max(maxY - minY, 1e-9);
    const scale = Math.min((rect.w - pad * 2) / spanX, (rect.h - pad * 2) / spanY);
    const toXY = (lat: number, lon: number) => {
      const m = webMercator(lat, lon);
      // y is flipped for screen coords
      const x = rect.x + pad + (m.x - minX) * scale + ((rect.w - pad * 2) - spanX * scale) / 2;
      const y = rect.y + pad + (maxY - m.y) * scale + ((rect.h - pad * 2) - spanY * scale) / 2;
      return { x, y };
    };
    for (const day of days) {
      for (const seg of day.segments) {
        if (seg.length < 2) continue;
        const draw = (width: number, style: string) => {
          ctx.beginPath();
          seg.forEach((p, i) => {
            const { x, y } = toXY(p.lat, p.lon);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          });
          ctx.lineWidth = width;
          ctx.strokeStyle = style;
          ctx.lineJoin = 'round';
          ctx.lineCap = 'round';
          ctx.stroke();
        };
        draw(14, tokens.text);
        draw(8, day.color);
      }
    }
  }
  ctx.restore();
}

async function drawBasemapTracks(
  ctx: CanvasRenderingContext2D,
  days: Day[],
  rect: { x: number; y: number; w: number; h: number },
  basemapId: string,
): Promise<string> {
  const basemap = getBasemap(basemapId);
  const holder = document.createElement('div');
  holder.style.cssText = `position:fixed;left:-10000px;top:0;width:${rect.w / 2}px;height:${rect.h / 2}px;`;
  document.body.appendChild(holder);
  const map = new maplibregl.Map({
    container: holder,
    style: basemap.style,
    interactive: false,
    pixelRatio: 2,
    canvasContextAttributes: { preserveDrawingBuffer: true },
    attributionControl: false,
    fadeDuration: 0,
  });
  try {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('圖磚載入超時（15 秒），請改用極簡風格')), 15000);
      map.on('error', (e: { error?: { message?: string } }) => {
        clearTimeout(timer);
        reject(new Error(`底圖載入失敗，請改用極簡風格（${(e as { error?: { message?: string } }).error?.message ?? '未知錯誤'}）`));
      });
      map.on('load', () => {
        const all = days.flatMap((d) => d.segments.flat());
        const features = [];
        for (const day of days) {
          for (const seg of day.segments) {
            if (seg.length < 2) continue;
            features.push({
              type: 'Feature',
              properties: { dayIndex: day.dayIndex, color: day.color },
              geometry: { type: 'LineString', coordinates: seg.map((p) => [p.lon, p.lat]) },
            });
          }
        }
        map.addSource('card-tracks', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features } as unknown as GeoJSON.FeatureCollection,
        });
        map.addLayer({
          id: 'card-casing',
          type: 'line',
          source: 'card-tracks',
          paint: { 'line-color': tokens.text, 'line-width': 7 },
        });
        const match: unknown[] = ['match', ['get', 'dayIndex']];
        for (const d of days) match.push(d.dayIndex, d.color);
        match.push('#000000');
        map.addLayer({
          id: 'card-colored',
          type: 'line',
          source: 'card-tracks',
          paint: { 'line-color': match as never, 'line-width': 4 },
        });
        if (all.length > 0) {
          const b = computeBounds(all)!;
          map.fitBounds(
            [
              [b.minLon, b.minLat],
              [b.maxLon, b.maxLat],
            ],
            { padding: 40, duration: 0 },
          );
        }
        map.once('idle', () => {
          clearTimeout(timer);
          resolve();
        });
      });
    });
    const src = map.getCanvas();
    ctx.save();
    roundRectPath(ctx, rect.x, rect.y, rect.w, rect.h, RADIUS);
    ctx.clip();
    ctx.drawImage(src, rect.x, rect.y, rect.w, rect.h);
    ctx.restore();
    return basemap.attribution.replace(/<[^>]*>/g, '');
  } finally {
    map.remove();
    holder.remove();
  }
}

export async function renderTripCard(opts: RenderOptions): Promise<Blob> {
  const { days, title, totalKm, style, basemapId = 'osm-standard' } = opts;
  if (days.length === 0) throw new Error('沒有軌跡資料');
  await ensureCardFonts(title);

  const canvas = document.createElement('canvas');
  canvas.width = CARD_SIZE;
  canvas.height = CARD_SIZE;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = tokens.bgCream;
  ctx.fillRect(0, 0, CARD_SIZE, CARD_SIZE);

  // Header
  const first = days[0].date;
  const last = days[days.length - 1].date;
  ctx.fillStyle = tokens.text;
  ctx.textBaseline = 'alphabetic';
  let cursorY = 190;
  if (title.trim() !== '') {
    ctx.font = `700 96px "Fredoka Variable", "Chiron GoRound TC Variable", sans-serif`;
    ctx.fillText(title.trim(), PADDING, cursorY, CARD_SIZE - PADDING * 2);
    cursorY += 90;
  }
  ctx.font = `400 54px "Nunito Variable", "Chiron GoRound TC Variable", sans-serif`;
  ctx.fillText(formatDateRange(first, last), PADDING, cursorY);

  // Map frame: hard shadow then bordered box
  ctx.fillStyle = tokens.text;
  roundRectPath(ctx, MAP_RECT.x + SHADOW_OFFSET, MAP_RECT.y + SHADOW_OFFSET, MAP_RECT.w, MAP_RECT.h, RADIUS);
  ctx.fill();
  ctx.save();
  roundRectPath(ctx, MAP_RECT.x, MAP_RECT.y, MAP_RECT.w, MAP_RECT.h, RADIUS);
  ctx.clip();
  ctx.fillStyle = tokens.secondary;
  ctx.fillRect(MAP_RECT.x, MAP_RECT.y, MAP_RECT.w, MAP_RECT.h);
  ctx.restore();

  let attributionText = '';
  if (style === 'minimal') {
    drawMinimalTracks(ctx, days, MAP_RECT);
  } else {
    attributionText = await drawBasemapTracks(ctx, days, MAP_RECT, basemapId);
  }
  // Border stroke on top
  ctx.save();
  roundRectPath(ctx, MAP_RECT.x, MAP_RECT.y, MAP_RECT.w, MAP_RECT.h, RADIUS);
  ctx.lineWidth = BORDER_W;
  ctx.strokeStyle = tokens.text;
  ctx.stroke();
  ctx.restore();

  // Footer pills
  const pillY = MAP_RECT.y + MAP_RECT.h + 70;
  const pillH = 96;
  const drawPill = (x: number, text: string, bg: string) => {
    ctx.font = `700 52px "Fredoka Variable", "Chiron GoRound TC Variable", sans-serif`;
    const w = ctx.measureText(text).width + 80;
    ctx.fillStyle = tokens.text;
    roundRectPath(ctx, x + 8, pillY + 8, w, pillH, pillH / 2);
    ctx.fill();
    ctx.fillStyle = bg;
    roundRectPath(ctx, x, pillY, w, pillH, pillH / 2);
    ctx.fill();
    ctx.lineWidth = 5;
    ctx.strokeStyle = tokens.text;
    ctx.stroke();
    ctx.fillStyle = tokens.text;
    ctx.fillText(text, x + 40, pillY + 65);
    return w;
  };
  let px = PADDING;
  px += drawPill(px, `${days.length} 天`, tokens.primary) + 32;
  px += drawPill(px, `${totalKm.toFixed(1)} km`, tokens.accentMint) + 32;

  // Legend
  ctx.font = `700 44px "Fredoka Variable", "Chiron GoRound TC Variable", sans-serif`;
  let lx = PADDING;
  const ly = pillY + pillH + 70;
  for (const d of days) {
    const label = `Day ${d.dayIndex}`;
    const w = ctx.measureText(label).width;
    if (lx + 44 + w > CARD_SIZE - PADDING) break;
    ctx.beginPath();
    ctx.arc(lx + 20, ly - 14, 20, 0, Math.PI * 2);
    ctx.fillStyle = d.color;
    ctx.fill();
    ctx.lineWidth = 5;
    ctx.strokeStyle = tokens.text;
    ctx.stroke();
    ctx.fillStyle = tokens.text;
    ctx.fillText(label, lx + 52, ly);
    lx += 52 + w + 40;
  }

  // Attribution
  ctx.font = `400 36px "Nunito Variable", sans-serif`;
  ctx.fillStyle = tokens.text;
  const attr = style === 'minimal' ? '' : attributionText;
  if (attr) ctx.fillText(attr, PADDING, CARD_SIZE - 60);

  const blob = await new Promise<Blob | null>((resolve) => {
    try {
      canvas.toBlob(resolve, 'image/png');
    } catch {
      resolve(null);
    }
  });
  if (!blob) throw new Error('底圖無法匯出，請改用極簡風格');
  return blob;
}
