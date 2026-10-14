import type { StampInk } from './stamp-palette';

/** Published template IDs are immutable artwork contracts. */
export type SealTemplate = 'cartouche-v1' | 'cartouche-v2';
export const DEFAULT_COUNTRY_INKS = ['vermilion', 'teal', 'plum', 'moss', 'navy', 'brick'] as const satisfies readonly StampInk[];

/** Called only when starting an unsaved seal; the chosen ink is then ordinary saved data. */
export function randomCountryInk(): StampInk {
  return DEFAULT_COUNTRY_INKS[Math.floor(Math.random() * DEFAULT_COUNTRY_INKS.length)]!;
}
