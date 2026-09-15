export interface TrackPoint {
  lat: number;
  lon: number;
  ele?: number;
  time: Date;
}

export type ParseResult =
  | { status: 'ok'; points: TrackPoint[] }
  | { status: 'no-time'; points: []; message: string }
  | { status: 'error'; points: []; message: string };

export interface DaySegment {
  points: TrackPoint[];
}

export interface Day {
  dayIndex: number; // 1-based
  date: string; // YYYY-MM-DD local date
  color: string;
  segments: TrackPoint[][];
  distanceKm: number;
}

export interface PhotoPin {
  id: string;
  name: string;
  lat: number;
  lon: number;
  takenAt?: string; // "YYYY-MM-DDTHH:mm:ss", camera local time, no timezone
}

export interface PhotoPending {
  done: number;
  total: number;
}
