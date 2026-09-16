import { beforeEach, describe, expect, it } from 'vitest';
import type { Day, TrackPoint } from '../src/core/types';
import type { AppState } from '../src/state';
import { mountSummary } from '../src/ui/summary';

const T0 = Date.parse('2026-03-12T01:00:00Z');

function pt(lat: number, lon: number, ele: number | undefined, tSec: number): TrackPoint {
  const p: TrackPoint = { lat, lon, time: new Date(T0 + tSec * 1000) };
  if (ele !== undefined) p.ele = ele;
  return p;
}

function lonDelta(meters: number): number {
  return ((meters / 6371000) * 180) / Math.PI;
}

function eleDay(dayIndex: number, date: string): Day {
  const seg = [pt(0, 0, 40, 0), pt(0, lonDelta(2000), 320, 600)];
  return { dayIndex, date, color: '#E53935', segments: [seg], distanceKm: 2 };
}

function flatDay(dayIndex: number, date: string): Day {
  const seg = [pt(0, 0, undefined, 0), pt(0, lonDelta(1000), undefined, 60)];
  return { dayIndex, date, color: '#1E88E5', segments: [seg], distanceKm: 1 };
}

interface StubState {
  days: Day[];
  timeZone: string;
  listeners: Array<() => void>;
  subscribe(fn: () => void): () => void;
  emit(): void;
}

function stub(days: Day[], timeZone = 'UTC'): StubState {
  const s: StubState = {
    days,
    timeZone,
    listeners: [],
    subscribe(fn) {
      s.listeners.push(fn);
      return () => {
        s.listeners = s.listeners.filter((l) => l !== fn);
      };
    },
    emit() {
      for (const l of [...s.listeners]) l();
    },
  };
  return s;
}

function buttons(container: HTMLElement): HTMLButtonElement[] {
  return [...container.querySelectorAll<HTMLButtonElement>('button.day-toggle')];
}

describe('summary accordion', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  it('3.1 rows are buttons with aria-expanded and keep Day/date/distance', () => {
    const state = stub([eleDay(1, '2026-03-12'), eleDay(2, '2026-03-13')]);
    mountSummary(container, state as unknown as AppState);
    const btns = buttons(container);
    expect(btns).toHaveLength(2);
    for (const b of btns) expect(b.getAttribute('aria-expanded')).toBe('false');
    expect(container.textContent).toContain('Day 1');
    expect(container.textContent).toContain('2026-03-12');
    expect(container.textContent).toContain('2.0 km');
    expect(container.querySelector('.dot')).not.toBeNull();
  });

  it('3.2 accordion: expand one, switch, collapse, initial state', () => {
    const state = stub([eleDay(1, '2026-03-12'), eleDay(2, '2026-03-13')]);
    mountSummary(container, state as unknown as AppState);
    // Initial: all collapsed, no charts.
    expect(container.querySelectorAll('svg')).toHaveLength(0);

    // Expand day 2.
    buttons(container)[1].click();
    let btns = buttons(container);
    expect(btns[1].getAttribute('aria-expanded')).toBe('true');
    expect(btns[0].getAttribute('aria-expanded')).toBe('false');
    expect(container.querySelectorAll('svg')).toHaveLength(1);

    // Switch to day 1: day 2 auto-collapses.
    btns[0].click();
    btns = buttons(container);
    expect(btns[0].getAttribute('aria-expanded')).toBe('true');
    expect(btns[1].getAttribute('aria-expanded')).toBe('false');
    expect(container.querySelectorAll('svg')).toHaveLength(1);

    // Click again: collapse all.
    btns[0].click();
    btns = buttons(container);
    expect(btns[0].getAttribute('aria-expanded')).toBe('false');
    expect(container.querySelectorAll('svg')).toHaveLength(0);
  });

  it('3.3 day without elevation shows a note, other days unaffected', () => {
    const state = stub([flatDay(1, '2026-03-12'), eleDay(2, '2026-03-13')]);
    mountSummary(container, state as unknown as AppState);
    buttons(container)[0].click();
    expect(container.textContent).toContain('該天沒有高度資料');
    expect(container.querySelectorAll('svg')).toHaveLength(0);

    buttons(container)[1].click();
    expect(container.querySelectorAll('svg')).toHaveLength(1);
    expect(container.querySelector('.elevation-empty')).toBeNull();
  });

  it('3.4 state changes reset expansion', () => {
    const state = stub([eleDay(1, '2026-03-12'), eleDay(2, '2026-03-13')]);
    mountSummary(container, state as unknown as AppState);
    buttons(container)[1].click();
    expect(buttons(container)[1].getAttribute('aria-expanded')).toBe('true');
    // Simulate timezone change / file removal re-render.
    state.emit();
    for (const b of buttons(container)) expect(b.getAttribute('aria-expanded')).toBe('false');
    expect(container.querySelectorAll('svg')).toHaveLength(0);
  });

  it('3.4 a state-driven re-render does not steal focus', () => {
    const state = stub([eleDay(1, '2026-03-12')]);
    mountSummary(container, state as unknown as AppState);
    const outside = document.createElement('button');
    document.body.appendChild(outside);
    outside.focus();
    state.emit();
    expect(document.activeElement).toBe(outside);
    outside.remove();
  });

  it('3.5 keyboard Enter toggles expansion', () => {
    const state = stub([eleDay(1, '2026-03-12')]);
    mountSummary(container, state as unknown as AppState);
    const btn = buttons(container)[0];
    btn.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(buttons(container)[0].getAttribute('aria-expanded')).toBe('true');
    buttons(container)[0].dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
    expect(buttons(container)[0].getAttribute('aria-expanded')).toBe('false');
  });

  it('3.5 focus stays on the toggled row across the re-render', () => {
    // render() rebuilds the list, so without an explicit restore the focused
    // button is destroyed and focus falls back to <body> — keyboard users lose
    // their place and the new aria-expanded state is never announced.
    const state = stub([eleDay(1, '2026-03-12'), eleDay(2, '2026-03-13')]);
    mountSummary(container, state as unknown as AppState);
    const btn = buttons(container)[1];
    btn.focus();
    btn.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    let active = document.activeElement as HTMLButtonElement;
    expect(active.classList.contains('day-toggle')).toBe(true);
    expect(active.dataset.day).toBe('2');
    expect(active.getAttribute('aria-expanded')).toBe('true');

    // Collapsing again keeps focus on the same row.
    active.click();
    active = document.activeElement as HTMLButtonElement;
    expect(active.dataset.day).toBe('2');
    expect(active.getAttribute('aria-expanded')).toBe('false');
  });

  it('3.5 each row points at its own panel via aria-controls', () => {
    const state = stub([eleDay(1, '2026-03-12'), eleDay(2, '2026-03-13')]);
    mountSummary(container, state as unknown as AppState);
    const ids = buttons(container).map((b) => b.getAttribute('aria-controls'));
    expect(new Set(ids).size).toBe(2);
    for (const id of ids) {
      expect(id).toBeTruthy();
      expect(container.querySelector(`#${id}`)?.classList.contains('elevation-container')).toBe(
        true,
      );
    }
  });
});

describe('day time and pace integration in summary accordion', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  it('3.1 展開一天後同時存在剖面 SVG 與五個標籤（出發、抵達、總時長、行進時間、均速）', () => {
    const state = stub([eleDay(1, '2026-03-12')]);
    mountSummary(container, state as unknown as AppState);
    buttons(container)[0].click();

    const wrap = container.querySelector('.elevation-container .day-expanded-wrap');
    expect(wrap).not.toBeNull();
    expect(wrap!.querySelector('svg')).not.toBeNull();
    expect(wrap!.querySelector('.day-time-stats')).not.toBeNull();
    expect(container.querySelectorAll('svg')).toHaveLength(1);
    expect(container.textContent).toContain('出發');
    expect(container.textContent).toContain('抵達');
    expect(container.textContent).toContain('總時長');
    expect(container.textContent).toContain('行進時間');
    expect(container.textContent).toContain('均速');
  });

  it('3.2 時間以 state.timeZone 呈現，不同時區顯示不同時刻', () => {
    // T0 = 2026-03-12T01:00:00Z. seg starts at T0 (01:00:00Z)
    // UTC: 01:00
    // Asia/Taipei (UTC+8): 09:00
    const stateUtc = stub([eleDay(1, '2026-03-12')], 'UTC');
    mountSummary(container, stateUtc as unknown as AppState);
    buttons(container)[0].click();
    expect(container.textContent).toContain('01:00');

    container.innerHTML = '';
    const stateTaipei = stub([eleDay(1, '2026-03-12')], 'Asia/Taipei');
    mountSummary(container, stateTaipei as unknown as AppState);
    buttons(container)[0].click();
    expect(container.textContent).toContain('09:00');
    expect(container.textContent).not.toContain('01:00');
  });

  it('3.3 沒有高度資料的一天仍顯示時間統計，說明文字與時間統計同時存在', () => {
    const state = stub([flatDay(1, '2026-03-12')]);
    mountSummary(container, state as unknown as AppState);
    buttons(container)[0].click();

    expect(container.querySelectorAll('svg')).toHaveLength(0);
    expect(container.textContent).toContain('該天沒有高度資料');
    expect(container.textContent).toContain('出發');
    expect(container.textContent).toContain('抵達');
    expect(container.textContent).toContain('總時長');
    expect(container.textContent).toContain('行進時間');
    expect(container.textContent).toContain('均速');
  });

  it('3.4 無法計算均速時顯示說明文字而非數值，不含 NaN 與 Infinity', () => {
    // 行進時間為零
    const p1 = pt(0, 0, undefined, 0);
    const p2 = pt(0, lonDelta(1000), undefined, 7200);
    // 兩段每段各 1 點
    const dayZeroMoving: Day = {
      dayIndex: 1,
      date: '2026-03-12',
      color: '#1E88E5',
      segments: [[p1], [p2]],
      distanceKm: 5,
    };
    const state = stub([dayZeroMoving]);
    mountSummary(container, state as unknown as AppState);
    buttons(container)[0].click();

    expect(container.textContent).toContain('無法計算');
    expect(container.textContent).not.toContain('NaN');
    expect(container.textContent).not.toContain('Infinity');
  });

  it('3.5 收合狀態下按鈕文字不含時刻與時間標籤', () => {
    const state = stub([eleDay(1, '2026-03-12')]);
    mountSummary(container, state as unknown as AppState);
    const btnText = buttons(container)[0].textContent || '';
    expect(btnText).toContain('Day 1');
    expect(btnText).toContain('2026-03-12');
    expect(btnText).toContain('2.0 km');
    expect(btnText).not.toContain('出發');
    expect(btnText).not.toContain('抵達');
    expect(btnText).not.toContain('總時長');
    expect(btnText).not.toContain('行進時間');
    expect(btnText).not.toContain('均速');
    expect(btnText).not.toMatch(/\d{2}:\d{2}/);
  });
});

