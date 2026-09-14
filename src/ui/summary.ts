import type { AppState } from '../state';

export function mountSummary(container: HTMLElement, state: AppState) {
  function render() {
    if (state.days.length === 0) {
      container.innerHTML = '<p class="empty-note">上傳 GPX 後會顯示每天的摘要</p>';
      return;
    }
    container.innerHTML =
      '<ul class="day-list">' +
      state.days
        .map(
          (d) =>
            `<li><span class="dot" style="background:${d.color}"></span><strong>Day ${d.dayIndex}</strong> ${d.date} · ${d.distanceKm.toFixed(1)} km</li>`,
        )
        .join('') +
      '</ul>';
  }
  state.subscribe(render);
  render();
}

export function mountStats(container: HTMLElement, state: AppState) {
  function render() {
    container.innerHTML = `<p><strong>${state.days.length}</strong> 天 · <strong>${state.totalKm.toFixed(1)}</strong> km</p>`;
  }
  state.subscribe(render);
  render();
}
