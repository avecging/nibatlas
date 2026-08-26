/**
 * The shared global stamp-ink palette.
 *
 * `BRAND.md` fixes this at eight colours for the whole system. The rules that
 * matter here, and that the tests in `stamp-palette.test.ts` enforce:
 *
 * - a standard stamp uses exactly one ink;
 * - no ink belongs to a country, locality, shop tier, rarity, or achievement;
 * - the palette version is pinned so an impression can be regenerated exactly;
 * - dual-ink and spectrum editions are future work and have no representation
 *   here at all.
 *
 * Ink choice is deliberately a pure function of the shop identifier. It is
 * stable, place-insensitive, and carries no meaning a user could decode as a
 * tier or a reward.
 */
export const STAMP_PALETTE_VERSION = 1;

export const STAMP_INKS = [
  "vermilion",
  "navy",
  "teal",
  "indigo",
  "plum",
  "moss",
  "ochre",
  "brick",
] as const;

export type StampInk = (typeof STAMP_INKS)[number];

/**
 * Ink values live here as literals rather than as references to the semantic
 * interface tokens in `globals.css`. Stamp inks are pigment, not UI state: four
 * of them have no interface role at all, and the four that share a hex value
 * with a brand colour must not start tracking it if that token is ever retuned.
 * The CSS side mirrors this table as `--ink-*` custom properties.
 */
export const STAMP_INK_HEX: Record<StampInk, string> = {
  vermilion: "#c54b32",
  navy: "#102d46",
  teal: "#287a78",
  indigo: "#365e88",
  plum: "#6b3f63",
  moss: "#4f653f",
  ochre: "#846024",
  brick: "#8a4338",
};

/** Human-readable ink name, used in the stamp's accessible description. */
export const STAMP_INK_LABELS: Record<StampInk, string> = {
  vermilion: "Vermilion",
  navy: "Atlas navy",
  teal: "Teal",
  indigo: "Indigo",
  plum: "Plum",
  moss: "Moss",
  ochre: "Ochre",
  brick: "Brick",
};

/**
 * Deterministic ink assignment.
 *
 * A small FNV-1a hash over the stamp key spreads the eight inks evenly without
 * any input from country, locality, shop type, or collection order — so no
 * colour can accumulate a meaning. The same key always yields the same ink, at
 * this palette version, on the server or the client.
 */
export function inkForStampKey(key: string): StampInk {
  let hash = 0x811c9dc5;

  for (let index = 0; index < key.length; index += 1) {
    hash ^= key.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }

  return STAMP_INKS[hash % STAMP_INKS.length] as StampInk;
}
