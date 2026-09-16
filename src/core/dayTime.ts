import type { Day, TrackPoint } from './types';

export interface DayTimeStats {
  startTime: Date | null;
  endTime: Date | null;
  totalDurationMs: number;
  movingDurationMs: number;
  avgSpeedKmh: number | null;
  hasData: boolean;
}

const timeFormatters = new Map<string, Intl.DateTimeFormat>();

function timeFormatterFor(timeZone: string): Intl.DateTimeFormat {
  let f = timeFormatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-GB', {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    timeFormatters.set(timeZone, f);
  }
  return f;
}

/**
 * Compute departure/arrival time, total duration, moving time, and average speed for a day.
 * - Total duration is from earliest to latest point.
 * - Moving time only accumulates adjacent point differences within the same segment.
 * - Average speed is day.distanceKm divided by moving time in hours.
 */
export function computeDayTime(day: Day): DayTimeStats {
  const points: TrackPoint[] = [];
  for (const seg of day.segments) {
    for (const p of seg) {
      points.push(p);
    }
  }

  if (points.length === 0) {
    return {
      startTime: null,
      endTime: null,
      totalDurationMs: 0,
      movingDurationMs: 0,
      avgSpeedKmh: null,
      hasData: false,
    };
  }

  const startTime = points[0].time;
  const endTime = points[points.length - 1].time;
  const totalDurationMs = Math.max(0, endTime.getTime() - startTime.getTime());

  let movingDurationMs = 0;
  for (const seg of day.segments) {
    for (let i = 1; i < seg.length; i++) {
      const dt = seg[i].time.getTime() - seg[i - 1].time.getTime();
      if (dt > 0) {
        movingDurationMs += dt;
      }
    }
  }

  let avgSpeedKmh: number | null = null;
  if (movingDurationMs > 0 && points.length >= 2) {
    const hours = movingDurationMs / 3600000;
    const speed = day.distanceKm / hours;
    if (Number.isFinite(speed)) {
      avgSpeedKmh = speed;
    }
  }

  return {
    startTime,
    endTime,
    totalDurationMs,
    movingDurationMs,
    avgSpeedKmh,
    hasData: true,
  };
}

/**
 * Format duration in ms:
 * < 60 mins -> "48 分"
 * >= 60 mins -> "6 小時 20 分"
 */
export function formatDuration(durationMs: number): string {
  const totalMinutes = Math.floor(Math.max(0, durationMs) / 60000);
  if (totalMinutes < 60) {
    return `${totalMinutes} 分`;
  }
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours} 小時 ${minutes} 分`;
}

/**
 * Format time in 24-hour HH:mm with specified time zone.
 */
export function formatTime(date: Date, timeZone: string): string {
  return timeFormatterFor(timeZone).format(date);
}

/**
 * Format speed to 1 decimal place with proper rounding.
 */
export function formatSpeed(speedKmh: number): string {
  const rounded = Math.round((speedKmh + Number.EPSILON) * 10) / 10;
  return rounded.toFixed(1);
}
