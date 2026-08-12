/**
 * Types for `contrast.mjs`.
 *
 * The implementation is plain JavaScript so that `check-contrast.mjs`, which
 * runs as a bare Node script, and the Astro build, which does not, can share
 * one copy of the rule. This file is what keeps the TypeScript side honest
 * about it.
 */

export interface ContrastPalette {
  base: string;
  surface: string;
  surfaceAlt: string;
  ink: string;
  inkMuted: string;
  line?: string;
  primary: string;
  onPrimary: string;
  accent: string;
  onAccent: string;
}

export interface ContrastFailure {
  /** e.g. `accent on base`. */
  name: string;
  fg: string;
  bg: string;
  /** The ratio actually reached. */
  value: number;
  /** The ratio required. */
  min: number;
}

export function mix(a: string, pct: number, b: string): string;
export function luminance(hex: string): number;
export function ratio(fg: string, bg: string): number;
export function isDarkPalette(palette: { base: string }): boolean;
export function pairsFor(palette: ContrastPalette): [string, string, string, number][];
export function paletteFailures(palette: ContrastPalette): ContrastFailure[];
export function clearsGate(
  palette: Omit<ContrastPalette, 'accent' | 'onAccent'>,
  swatch: { accent: string; onAccent: string },
): boolean;
