import type { AppState } from '../state';

export function mountTimezone(container: HTMLElement, state: AppState) {
  const zones: string[] =
    typeof Intl !== 'undefined' && 'supportedValuesOf' in Intl
      ? (Intl as unknown as { supportedValuesOf(k: string): string[] }).supportedValuesOf('timeZone')
      : ['UTC', 'Asia/Taipei'];
  const select = document.createElement('select');
  select.id = 'tzSelect';
  select.setAttribute('aria-label', '選擇時區');
  for (const z of zones) {
    const opt = document.createElement('option');
    opt.value = z;
    opt.textContent = z;
    if (z === state.timeZone) opt.selected = true;
    select.appendChild(opt);
  }
  const label = document.createElement('label');
  label.htmlFor = 'tzSelect';
  label.textContent = '時區';
  container.append(label, select);
  select.addEventListener('change', () => state.setTimeZone(select.value));
}
