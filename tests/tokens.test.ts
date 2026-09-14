import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { TRACK_COLORS, tokens } from '../src/styles/tokens';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const css = readFileSync(join(root, 'src/styles/tokens.css'), 'utf8');

describe('design tokens sync', () => {
  it('css mirrors ts token values', () => {
    for (const [cssName, value] of [
      ['--text', tokens.text],
      ['--text-muted', tokens.textMuted],
      ['--bg', tokens.bg],
      ['--bg-cream', tokens.bgCream],
      ['--primary', tokens.primary],
      ['--secondary', tokens.secondary],
      ['--accent-purple', tokens.accentPurple],
      ['--accent-mint', tokens.accentMint],
      ['--cta', tokens.cta],
    ] as const) {
      expect(css).toContain(`${cssName}: ${value}`);
    }
  });

  it('track palette has 10 vivid colors distinct from pastel UI', () => {
    expect(TRACK_COLORS).toHaveLength(10);
    const pastel = [tokens.primary, tokens.secondary, tokens.accentPurple, tokens.accentMint].map(
      (c) => c.toLowerCase(),
    );
    for (const c of TRACK_COLORS) {
      expect(pastel).not.toContain(c.toLowerCase());
    }
    expect(new Set(TRACK_COLORS.map((c) => c.toLowerCase())).size).toBe(10);
  });
});
