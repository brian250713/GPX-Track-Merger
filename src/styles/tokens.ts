/**
 * Design tokens (D11) — single source of truth for CSS + canvas.
 * CSS file `tokens.css` mirrors these values; `tokens.test.ts` verifies sync.
 */
export const tokens = {
  text: '#2d3748',
  textMuted: '#64748b',
  bg: '#ffffff',
  bgCream: '#fff9f5',
  primary: '#fdbcb4',
  secondary: '#add8e6',
  accentPurple: '#e6e6fa',
  accentMint: '#98ff98',
  cta: '#22c55e',
  ctaDark: '#15803d',
  borderWidth: 3,
  radiusCard: 24,
  radiusButton: 16,
  shadowCard: '6px 6px 0 #2d3748',
  shadowButton: '4px 4px 0 #2d3748',
  shadowButtonHover: '2px 2px 0 #2d3748',
  fontHeading: '"Fredoka Variable", "Chiron GoRound TC Variable", sans-serif',
  fontBody: '"Nunito Variable", "Chiron GoRound TC Variable", sans-serif',
} as const;

export type Tokens = typeof tokens;

/**
 * 10-color vivid track palette (D6/D11).
 * - Vivid / high saturation, NOT pastel interface colors.
 * - Same color used on map, day summary, and trip card for a given Day.
 * - Day N uses TRACK_COLORS[(N-1) % 10].
 */
export const TRACK_COLORS = [
  '#E53935',
  '#1E88E5',
  '#00897B',
  '#FB8C00',
  '#8E24AA',
  '#00ACC1',
  '#D81B60',
  '#43A047',
  '#5C6BC0',
  '#6D4C41',
] as const;

export function colorForDay(dayIndex1Based: number): string {
  const i = ((dayIndex1Based - 1) % TRACK_COLORS.length + TRACK_COLORS.length) % TRACK_COLORS.length;
  return TRACK_COLORS[i];
}
