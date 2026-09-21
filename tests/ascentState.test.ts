import { describe, expect, it } from 'vitest';
import { totalAscentM } from '../src/core/elevation';
import { AppState } from '../src/state';

/** One-track GPX starting at `start` (UTC), one point per minute. */
function gpx(start: string, eles: (number | undefined)[]): File {
  const t0 = Date.parse(start);
  const pts = eles
    .map((e, i) => {
      const time = new Date(t0 + i * 60000).toISOString();
      const ele = e === undefined ? '' : `<ele>${e}</ele>`;
      return `<trkpt lat="25.0" lon="${121.5 + i * 0.001}">${ele}<time>${time}</time></trkpt>`;
    })
    .join('');
  const xml = `<?xml version="1.0"?><gpx version="1.1" creator="test"><trk><trkseg>${pts}</trkseg></trk></gpx>`;
  return new File([xml], `${start.slice(0, 10)}.gpx`);
}

describe('AppState.totalAscentM', () => {
  it('3.1 matches totalAscentM(state.days) after merging several files', async () => {
    const state = new AppState();
    state.timeZone = 'UTC';
    await state.addFiles([
      gpx('2026-03-12T01:00:00Z', [100, 150, 200, 250, 300]),
      gpx('2026-03-13T01:00:00Z', [500, 480, 520, 600]),
    ]);
    expect(state.days).toHaveLength(2);
    expect(state.totalAscentM).toBe(totalAscentM(state.days));
    expect(state.totalAscentM).toBeCloseTo(200 + 120, 6);
  });

  it('3.1 is null when no file carries elevation', async () => {
    const state = new AppState();
    await state.addFiles([gpx('2026-03-12T01:00:00Z', [undefined, undefined, undefined])]);
    expect(state.days.length).toBeGreaterThan(0);
    expect(state.totalAscentM).toBeNull();
  });
});
