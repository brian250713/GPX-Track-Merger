import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const componentsCss = readFileSync(join(root, 'src/styles/components.css'), 'utf8');
const mainTs = readFileSync(join(root, 'src/main.ts'), 'utf8');

describe('swap summary and stats layout', () => {
  it('1.1 寬螢幕 grid-template-areas 包含 "stats summary" 且不含 "summary stats"', () => {
    expect(componentsCss).toContain('"stats summary"');
    expect(componentsCss).not.toContain('"summary stats"');
  });

  it('1.2 窄螢幕 grid-template-areas 中 "stats" 出現在 "summary" 之前且七個區塊齊全', () => {
    const mediaMatch = componentsCss.match(/@media\s*\(max-width:\s*800px\)\s*\{([\s\S]*?)\n\}/);
    expect(mediaMatch).not.toBeNull();
    const mediaBlock = mediaMatch![1];
    const areasMatch = mediaBlock.match(/grid-template-areas:\s*([^;]+);/);
    expect(areasMatch).not.toBeNull();
    const areasStr = areasMatch![1];

    const statsIndex = areasStr.indexOf('"stats"');
    const summaryIndex = areasStr.indexOf('"summary"');
    expect(statsIndex).toBeGreaterThan(-1);
    expect(summaryIndex).toBeGreaterThan(-1);
    expect(statsIndex).toBeLessThan(summaryIndex);

    const requiredAreas = ['"header"', '"upload"', '"map"', '"files"', '"stats"', '"summary"', '"export"'];
    for (const area of requiredAreas) {
      expect(areasStr).toContain(area);
    }
  });

  it('1.3 #app 樣板中 statsBox 在文件中早於 summaryBox (閱讀順序與視覺順序一致)', () => {
    const match = mainTs.match(/innerHTML\s*=\s*`([\s\S]*?)`;/);
    expect(match).not.toBeNull();
    const template = match![1];

    const container = document.createElement('div');
    container.innerHTML = template;

    const statsBox = container.querySelector('#statsBox');
    const summaryBox = container.querySelector('#summaryBox');
    expect(statsBox).not.toBeNull();
    expect(summaryBox).not.toBeNull();

    const position = statsBox!.compareDocumentPosition(summaryBox!);
    expect(position & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('1.4 區塊底色未隨位置改變 (.area-summary 為 --accent-purple, .area-stats 為 --secondary)', () => {
    expect(componentsCss).toMatch(/\.area-summary\s*\{[^}]*background:\s*var\(--accent-purple\)/);
    expect(componentsCss).toMatch(/\.area-stats\s*\{[^}]*background:\s*var\(--secondary\)/);
  });

  it('2.1 .day-elevation-col 含 max-width: 420px', () => {
    const colRuleMatch = componentsCss.match(/\.day-elevation-col\s*\{([^}]+)\}/);
    expect(colRuleMatch).not.toBeNull();
    expect(colRuleMatch![1]).toContain('max-width: 420px');
    expect(colRuleMatch![1]).not.toContain('max-width: 100%');
  });

  it('2.4 .day-elevation-col 為直向 flex 欄，剖面 SVG 與說明文字不再帶 flex 與 max-width', () => {
    const col = componentsCss.match(/\.day-elevation-col\s*\{([^}]+)\}/)![1];
    expect(col).toContain('flex: 1 1 320px');
    expect(col).toContain('max-width: 420px');
    expect(col).toContain('min-width: 0');
    expect(col).toContain('flex-direction: column');

    const svg = componentsCss.match(/\.elevation-container svg\s*\{([^}]+)\}/)![1];
    expect(svg).toContain('width: 100%');
    expect(svg).toContain('height: auto');
    expect(svg).not.toMatch(/\bflex:/);
    expect(svg).not.toContain('max-width');
    // Border included in the 100% width, so the chart never pokes past its column.
    expect(svg).toContain('box-sizing: border-box');

    const empty = componentsCss.match(/\.elevation-empty\s*\{([^}]+)\}/)![1];
    expect(empty).not.toMatch(/\bflex:/);
    expect(empty).not.toContain('max-width');
  });

  it('3.2 展開區塊以 flex-wrap 實作並排且無新增 @media', () => {
    expect(componentsCss).toMatch(/\.day-expanded-wrap\s*\{[^}]*flex-wrap:\s*wrap/);
    expect(componentsCss).toMatch(/\.day-elevation-col\s*\{[^}]*flex:\s*1 1 320px/);
    expect(componentsCss).toMatch(/\.day-time-stats\s*\{[^}]*flex:\s*1 1 260px/);

    // 展開區塊段落未引入任何新的 @media
    const elevationSection = componentsCss.slice(
      componentsCss.indexOf('.elevation-container'),
      componentsCss.indexOf('.badge'),
    );
    expect(elevationSection).not.toContain('@media');
  });

  it('3.4 .day-time-stats 的 repeat(auto-fit, minmax(100px, 1fr)) 原樣保留', () => {
    expect(componentsCss).toContain('grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));');
  });
});
