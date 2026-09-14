import { groupByDay, mergeAndSort, totalDistanceKm } from './core/grouping';
import { parseGpx } from './core/parse';
import type { Day } from './core/types';

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
