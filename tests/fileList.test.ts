import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeEach, describe, expect, it } from 'vitest';
import { AppState } from '../src/state';
import { mountFileList } from '../src/ui/fileList';

const here = dirname(fileURLToPath(import.meta.url));
const gpx = readFileSync(join(here, 'fixtures', 'multi-segment.gpx'), 'utf8');

const removeButtons = (c: HTMLElement) => [...c.querySelectorAll<HTMLButtonElement>('.btn-remove')];
const names = (c: HTMLElement) => removeButtons(c).map((b) => b.getAttribute('aria-label'));

describe('file list keyboard focus after removal', () => {
  let container: HTMLElement;
  let state: AppState;

  beforeEach(async () => {
    document.body.innerHTML = '<div id="fileBox"></div>';
    container = document.getElementById('fileBox')!;
    state = new AppState();
    mountFileList(container, state);
    await state.addFiles(['a.gpx', 'b.gpx', 'c.gpx'].map((n) => new File([gpx], n)));
  });

  it('moves focus to the button that took the removed one’s place', () => {
    const [, b] = removeButtons(container);
    b.focus();
    b.click();
    expect(names(container)).toEqual(['移除 a.gpx', '移除 c.gpx']);
    expect(document.activeElement?.getAttribute('aria-label')).toBe('移除 c.gpx');
  });

  it('moves focus to the previous button when the last one is removed', () => {
    const c = removeButtons(container)[2];
    c.focus();
    c.click();
    expect(document.activeElement?.getAttribute('aria-label')).toBe('移除 b.gpx');
  });

  it('moves focus to the file list when no files remain', () => {
    for (let i = 0; i < 3; i++) {
      const btn = removeButtons(container)[0];
      btn.focus();
      btn.click();
    }
    expect(removeButtons(container)).toHaveLength(0);
    expect(document.activeElement).toBe(container);
  });

  it('does not steal focus when the button was not focused', () => {
    const input = document.body.appendChild(document.createElement('input'));
    input.focus();
    removeButtons(container)[0].click();
    expect(document.activeElement).toBe(input);
  });
});
