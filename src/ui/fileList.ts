import type { AppState } from '../state';

export function mountFileList(container: HTMLElement, state: AppState) {
  function render() {
    if (state.files.length === 0) {
      container.innerHTML = '<p class="empty-note">尚未加入檔案</p>';
      return;
    }
    container.innerHTML =
      '<ul class="file-list">' +
      state.files
        .map((f) => {
          const badge =
            f.status.kind === 'ok'
              ? `<span class="badge ok">${f.status.points} 點</span>`
              : f.status.kind === 'warning'
                ? `<span class="badge warn">⚠ ${escapeHtml(f.status.message)}</span>`
                : `<span class="badge err">✖ ${escapeHtml(f.status.message)}</span>`;
          return `<li>${escapeHtml(f.name)} ${badge} <button type="button" class="btn-remove" data-id="${f.id}" aria-label="移除 ${escapeHtml(f.name)}">移除</button></li>`;
        })
        .join('') +
      '</ul>';
    const buttons = [...container.querySelectorAll<HTMLButtonElement>('.btn-remove')];
    buttons.forEach((btn, index) => {
      btn.addEventListener('click', () => {
        const hadFocus = document.activeElement === btn;
        state.removeFile(btn.dataset.id!);
        // The re-render destroyed the focused button; keep keyboard users in
        // place instead of dropping focus back to the top of the page.
        if (!hadFocus) return;
        const remaining = container.querySelectorAll<HTMLButtonElement>('.btn-remove');
        (remaining[Math.min(index, remaining.length - 1)] ?? container).focus();
      });
    });
  }
  // Focus target when the last file is removed (not in the Tab order).
  container.tabIndex = -1;
  state.subscribe(render);
  render();
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}
