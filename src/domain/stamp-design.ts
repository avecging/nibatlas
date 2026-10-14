import type { StampMotif } from "@/src/domain/shop-detail";

/**
 * Version of the frontend-owned stamp design rules.
 *
 * A stamp's art is generated, not stored, so an impression regenerates
 * identically only while the rules that produced it are pinned. The prototype
 * catalogue and the Milestone 3 API projection both stamp records with this
 * number rather than each keeping its own, so a fixture impression and an
 * API-backed one of the same shop are the same design.
 */
export const STAMP_DESIGN_VERSION = 1;

/**
 * The motifs a generated shop stamp may use.
 *
 * `BRAND.md` forbids applying one country's iconography to another, so the list
 * is stationery culture and generic street architecture only, and nothing in it
 * is country-specific.
 */
export const STAMP_MOTIFS = [
  "storefront",
  "shophouse",
  "ink-bottle",
  "nib",
  "arcade",
  "harbour",
  "counter",
  "workbench",
] as const satisfies readonly StampMotif[];

/**
 * Deterministic motif assignment for a record that does not carry a chosen one.
 *
 * The prototype catalogue picks each shop's motif by hand, from what the shop
 * itself is. A database-backed record has no such field, and inventing one from
 * the country or the shop type is exactly what `BRAND.md` forbids — so the motif
 * is chosen blind, from the stamp key alone, the same way
 * `inkForStampKey` chooses ink.
 *
 * The key is namespaced so motif and ink cannot move together: the same shop
 * would otherwise hash once and correlate its two design choices.
 */
export function motifForStampKey(key: string): StampMotif {
  let hash = 0x811c9dc5;
  const namespaced = `motif:${key}`;

  for (let index = 0; index < namespaced.length; index += 1) {
    hash ^= namespaced.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }

  return STAMP_MOTIFS[hash % STAMP_MOTIFS.length] as StampMotif;
}
