import { computeElevationProfile } from '../core/elevation';
import type { AppState } from '../state';
import { renderElevationSvg } from './elevationProfile';

export const NO_ELEVATION_TEXT = '該天沒有高度資料';

export function mountSummary(container: HTMLElement, state: AppState) {
  // View-only accordion state: never stored in AppState, so expanding a day
  // does not trigger a global emit()/map redraw. Any state change rebuilds
  // the list via subscribe and resets to all-collapsed.
  let expanded: number | null = null;

  function toggle(dayIndex: number) {
    expanded = expanded === dayIndex ? null : dayIndex;
    render();
  }

  function rowBody(day: (typeof state.days)[number]): string {
    const prof = computeElevationProfile(day);
    if (prof.hasData) return renderElevationSvg(day, prof);
    return `<p class="elevation-empty">${NO_ELEVATION_TEXT}</p>`;
  }

  function render() {
    if (state.days.length === 0) {
      container.innerHTML = '<p class="empty-note">上傳 GPX 後會顯示每天的摘要</p>';
      return;
    }
    container.innerHTML =
      '<ul class="day-list">' +
      state.days
        .map((d) => {
          const open = expanded === d.dayIndex;
          return (
            `<li class="day-item">` +
            `<button type="button" class="day-toggle" aria-expanded="${open ? 'true' : 'false'}" data-day="${d.dayIndex}">` +
            `<span class="dot" style="background:${d.color}"></span>` +
            `<strong>Day ${d.dayIndex}</strong> ${d.date} · ${d.distanceKm.toFixed(1)} km` +
            `</button>` +
            `<div class="elevation-container"${open ? '' : ' hidden'}>` +
            (open ? rowBody(d) : '') +
            `</div></li>`
          );
        })
        .join('') +
      '</ul>';
    container.querySelectorAll<HTMLButtonElement>('button.day-toggle').forEach((btn) => {
      const idx = Number(btn.dataset.day);
      btn.addEventListener('click', () => toggle(idx));
      btn.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
          // preventDefault cancels the button's native key activation so the
          // toggle happens exactly once (native click is suppressed).
          e.preventDefault();
          toggle(idx);
        }
      });
    });
  }
  state.subscribe(() => {
    expanded = null;
    render();
  });
  render();
}

export function mountStats(container: HTMLElement, state: AppState) {
  function render() {
    container.innerHTML = `<p><strong>${state.days.length}</strong> 天 · <strong>${state.totalKm.toFixed(1)}</strong> km</p>`;
  }
  state.subscribe(render);
  render();
}
