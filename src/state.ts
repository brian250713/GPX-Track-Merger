import { groupByDay, mergeAndSort, totalDistanceKm } from './core/grouping';
import { parseGpx } from './core/parse';
import { readPhotoMeta, type PhotoMeta } from './core/photoMeta';
import type { Day, PhotoPending, PhotoPin } from './core/types';

export type FileStatus =
  | { kind: 'ok'; points: number }
  | { kind: 'warning'; message: string }
  | { kind: 'error'; message: string };

export interface FileEntry {
  id: string;
  name: string;
  status: FileStatus;
}

export type CardStyle = 'with-basemap' | 'minimal';

interface Listener {
  (): void;
}

let seq = 0;

export class AppState {
  files: FileEntry[] = [];
  /** Parsed points cached per file id. */
  private pointsCache = new Map<string, import('./core/types').TrackPoint[]>();
  timeZone: string =
    typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'UTC';
  title = '';
  cardStyle: CardStyle = 'with-basemap';
  days: Day[] = [];
  /** Photo pins (D1): only { id, name, lat, lon, takenAt? } — never File/Blob/object URL. */
  photos: PhotoPin[] = [];
  photoMissingCount = 0;
  photoPending: PhotoPending | null = null;
  private photoGeneration = 0;
  private listeners = new Set<Listener>();

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  private emit() {
    for (const fn of this.listeners) fn();
  }

  private recompute() {
    const lists = this.files.flatMap((f) => {
      const pts = this.pointsCache.get(f.id);
      return pts ? [pts] : [];
    });
    const merged = mergeAndSort(lists);
    this.days = groupByDay(merged, this.timeZone);
    this.emit();
  }

  async addFiles(files: File[]) {
    for (const file of files) {
      if (!/\.gpx$/i.test(file.name)) continue;
      const id = `f${++seq}`;
      const text = await file.text();
      const result = parseGpx(text);
      if (result.status === 'ok') {
        this.pointsCache.set(id, result.points);
        this.files.push({ id, name: file.name, status: { kind: 'ok', points: result.points.length } });
      } else if (result.status === 'no-time') {
        this.pointsCache.delete(id);
        this.files.push({ id, name: file.name, status: { kind: 'warning', message: result.message } });
      } else {
        this.pointsCache.delete(id);
        this.files.push({ id, name: file.name, status: { kind: 'error', message: result.message } });
      }
    }
    this.recompute();
  }

  removeFile(id: string) {
    this.files = this.files.filter((f) => f.id !== id);
    this.pointsCache.delete(id);
    this.recompute();
  }

  /**
   * D4: batch photo ingest. Concurrency 4, throttled progress emits, one
   * final merge with a new `photos` array reference. In-flight batches are
   * discarded when clearPhotos() bumps the generation in between.
   * The `reader` param defaults to readPhotoMeta (tests inject a stub).
   */
  async addPhotos(files: File[], reader: (blob: Blob) => Promise<PhotoMeta | null> = readPhotoMeta) {
    if (files.length === 0) return;
    const generation = this.photoGeneration;
    if (this.photoPending) {
      this.photoPending = {
        done: this.photoPending.done,
        total: this.photoPending.total + files.length,
      };
    } else {
      this.photoPending = { done: 0, total: files.length };
    }
    this.emit();
    const results: (PhotoMeta & { name: string })[] = new Array(files.length);
    const missingIdx = new Set<number>();
    let next = 0;
    let sinceEmit = 0;
    let lastEmit = Date.now();
    const total = files.length;
    const noteProgress = () => {
      if (!this.photoPending) return;
      this.photoPending = { done: this.photoPending.done + 1, total: this.photoPending.total };
      sinceEmit += 1;
      const now = Date.now();
      if (sinceEmit >= 25 || now - lastEmit >= 250 || this.photoPending.done >= this.photoPending.total) {
        sinceEmit = 0;
        lastEmit = now;
        this.emit();
      }
    };
    const workers: Promise<void>[] = [];
    for (let w = 0; w < Math.min(4, total); w += 1) {
      workers.push(
        (async () => {
          for (;;) {
            const i = next;
            next += 1;
            if (i >= total) return;
            const file = files[i];
            let meta: PhotoMeta | null = null;
            try {
              meta = await reader(file);
            } catch {
              meta = null;
            }
            if (meta) {
              results[i] = { ...meta, name: file.name };
            } else {
              missingIdx.add(i);
            }
            noteProgress();
          }
        })(),
      );
    }
    await Promise.all(workers);
    if (generation !== this.photoGeneration) return; // cleared mid-read: drop results
    const pins: PhotoPin[] = [];
    for (let i = 0; i < total; i += 1) {
      if (missingIdx.has(i)) continue;
      const r = results[i];
      pins.push({ id: `p${++seq}`, name: r.name, lat: r.lat, lon: r.lon, ...(r.takenAt ? { takenAt: r.takenAt } : {}) });
    }
    this.photos = [...this.photos, ...pins];
    this.photoMissingCount += missingIdx.size;
    if (this.photoPending && this.photoPending.done >= this.photoPending.total) {
      this.photoPending = null;
    }
    this.emit();
  }

  clearPhotos() {
    this.photos = [];
    this.photoMissingCount = 0;
    this.photoPending = null;
    this.photoGeneration += 1;
    this.emit();
  }

  setTimeZone(tz: string) {
    this.timeZone = tz;
    this.recompute();
  }

  setTitle(title: string) {
    this.title = title;
    this.emit();
  }

  setCardStyle(style: CardStyle) {
    this.cardStyle = style;
    this.emit();
  }

  get totalKm(): number {
    return totalDistanceKm(this.days);
  }
}
