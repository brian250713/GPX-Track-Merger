import { describe, expect, it } from 'vitest';
import {
  computeDayTime,
  formatDuration,
  formatSpeed,
  formatTime,
} from '../src/core/dayTime';
import type { Day, TrackPoint } from '../src/core/types';

function createPoint(isoString: string): TrackPoint {
  return {
    lat: 25.0,
    lon: 121.5,
    time: new Date(isoString),
  };
}

function createDay(segments: TrackPoint[][], distanceKm = 10): Day {
  return {
    dayIndex: 1,
    date: '2026-03-12',
    color: '#E53935',
    segments,
    distanceKm,
  };
}

describe('1. 時間統計計算 (computeDayTime)', () => {
  it('1.1 單一段落情境：出發時間、抵達時間與總時長', () => {
    // 08:12 到 16:33 (8 小時 21 分 = 501 分鐘 = 30060000 ms)
    const seg = [
      createPoint('2026-03-12T08:12:00Z'),
      createPoint('2026-03-12T12:00:00Z'),
      createPoint('2026-03-12T16:33:00Z'),
    ];
    const day = createDay([seg]);
    const stats = computeDayTime(day);

    expect(stats.startTime).toEqual(new Date('2026-03-12T08:12:00Z'));
    expect(stats.endTime).toEqual(new Date('2026-03-12T16:33:00Z'));
    expect(stats.totalDurationMs).toBe(501 * 60 * 1000);
  });

  it('1.1 含斷開的一天情境：總時長仍是首尾相減', () => {
    // 第一段 08:00–10:00，中間搭車 2 小時，第二段 12:00–15:00
    const seg1 = [
      createPoint('2026-03-12T08:00:00Z'),
      createPoint('2026-03-12T10:00:00Z'),
    ];
    const seg2 = [
      createPoint('2026-03-12T12:00:00Z'),
      createPoint('2026-03-12T15:00:00Z'),
    ];
    const day = createDay([seg1, seg2]);
    const stats = computeDayTime(day);

    expect(stats.startTime).toEqual(new Date('2026-03-12T08:00:00Z'));
    expect(stats.endTime).toEqual(new Date('2026-03-12T15:00:00Z'));
    // 總時長為 08:00 到 15:00 = 7 小時
    expect(stats.totalDurationMs).toBe(7 * 3600 * 1000);
  });

  it('1.2 斷開處不計入行進時間（5 小時而非 7 小時）', () => {
    // 第一段 08:00–10:00 (2h)，中間斷開 2 小時，第二段 12:00–15:00 (3h)
    const seg1 = [
      createPoint('2026-03-12T08:00:00Z'),
      createPoint('2026-03-12T10:00:00Z'),
    ];
    const seg2 = [
      createPoint('2026-03-12T12:00:00Z'),
      createPoint('2026-03-12T15:00:00Z'),
    ];
    const day = createDay([seg1, seg2]);
    const stats = computeDayTime(day);

    expect(stats.movingDurationMs).toBe(5 * 3600 * 1000);
    expect(stats.totalDurationMs).toBe(7 * 3600 * 1000);
  });

  it('1.2 沒有斷開時行進時間等於總時長', () => {
    // 08:12 連續記錄到 16:33
    const seg = [
      createPoint('2026-03-12T08:12:00Z'),
      createPoint('2026-03-12T16:33:00Z'),
    ];
    const day = createDay([seg]);
    const stats = computeDayTime(day);

    expect(stats.movingDurationMs).toBe(stats.totalDurationMs);
    expect(stats.movingDurationMs).toBe(501 * 60 * 1000);
  });

  it('1.2 短休息計入行進時間（仍為同一個段落）', () => {
    // 中途停下休息 20 分鐘（未達 30 分鐘門檻，仍在同一段落）
    const seg = [
      createPoint('2026-03-12T08:00:00Z'),
      createPoint('2026-03-12T09:00:00Z'),
      createPoint('2026-03-12T09:20:00Z'), // 休息 20 分鐘
      createPoint('2026-03-12T10:20:00Z'),
    ];
    const day = createDay([seg]);
    const stats = computeDayTime(day);

    expect(day.segments).toHaveLength(1);
    expect(stats.movingDurationMs).toBe(140 * 60 * 1000); // 2 小時 20 分
    expect(stats.movingDurationMs).toBe(stats.totalDurationMs);
  });

  it('1.3 平均速度以 day.distanceKm 除以行進時間計算（110.2 公里，6 小時 20 分 -> 17.4）且分子取自 day.distanceKm', () => {
    // 6 小時 20 分 = 380 分鐘 = 22800 秒
    const seg = [
      createPoint('2026-03-12T08:00:00Z'),
      createPoint('2026-03-12T14:20:00Z'),
    ];
    const day = createDay([seg], 110.2);
    const stats = computeDayTime(day);

    expect(stats.movingDurationMs).toBe(380 * 60 * 1000);
    expect(stats.avgSpeedKmh).not.toBeNull();
    expect(formatSpeed(stats.avgSpeedKmh!)).toBe('17.4');

    // 斷言分子確實取自 day.distanceKm 而非由點座標重新累加
    const dayCustomDist = createDay([seg], 55.1);
    const statsCustom = computeDayTime(dayCustomDist);
    // 55.1 / 6.333333333333333 = 8.7
    expect(formatSpeed(statsCustom.avgSpeedKmh!)).toBe('8.7');
  });

  it('1.4 只有一個點：出發抵達相同，總時長與行進時間為 0，平均速度無法計算（不含 NaN／Infinity）', () => {
    const singlePt = createPoint('2026-03-12T08:00:00Z');
    const day = createDay([[singlePt]], 0);
    const stats = computeDayTime(day);

    expect(stats.startTime).toEqual(singlePt.time);
    expect(stats.endTime).toEqual(singlePt.time);
    expect(stats.totalDurationMs).toBe(0);
    expect(stats.movingDurationMs).toBe(0);
    expect(stats.avgSpeedKmh).toBeNull();
    expect(Number.isNaN(stats.totalDurationMs)).toBe(false);
    expect(Number.isNaN(stats.movingDurationMs)).toBe(false);
  });

  it('1.4 行進時間為零（多個段落但每段僅一點）：平均速度無法計算（不含 NaN／Infinity）', () => {
    const pt1 = createPoint('2026-03-12T08:00:00Z');
    const pt2 = createPoint('2026-03-12T12:00:00Z');
    // 兩個段落，每段只有一個點
    const day = createDay([[pt1], [pt2]], 5.0);
    const stats = computeDayTime(day);

    expect(stats.startTime).toEqual(pt1.time);
    expect(stats.endTime).toEqual(pt2.time);
    expect(stats.totalDurationMs).toBe(4 * 3600 * 1000);
    expect(stats.movingDurationMs).toBe(0);
    expect(stats.avgSpeedKmh).toBeNull();
    expect(Number.isNaN(stats.totalDurationMs)).toBe(false);
    expect(Number.isNaN(stats.movingDurationMs)).toBe(false);
  });
});

describe('2. 格式化函式', () => {
  it('2.1 時長格式化：超過一小時、不足一小時、0 分鐘與剛好 60 分鐘邊界', () => {
    // 超過一小時：6 小時 20 分 (380 分鐘)
    expect(formatDuration(380 * 60 * 1000)).toBe('6 小時 20 分');

    // 不足一小時：48 分鐘
    expect(formatDuration(48 * 60 * 1000)).toBe('48 分');

    // 0 分鐘邊界
    expect(formatDuration(0)).toBe('0 分');

    // 剛好 60 分鐘邊界
    expect(formatDuration(60 * 60 * 1000)).toBe('1 小時 0 分');
  });

  it('2.2 時刻格式化：以傳入時區產生 24 小時制 HH:mm (2026-03-12T00:12:00Z + Asia/Taipei -> 08:12)', () => {
    const date = new Date('2026-03-12T00:12:00Z');
    expect(formatTime(date, 'Asia/Taipei')).toBe('08:12');
  });

  it('2.3 速度格式化：小數點後 1 位，斷言 17.44 與 17.45', () => {
    expect(formatSpeed(17.44)).toBe('17.4');
    expect(formatSpeed(17.45)).toBe('17.5');
  });
});
