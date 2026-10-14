import { STAMP_MOTIFS } from './stamp-design';
import { STAMP_INKS, inkForStampKey, type StampInk } from './stamp-palette';
import type { StampMotif } from './shop-detail';

export const SHOP_SEAL_SHAPES = ['shield', 'oval', 'rectangle'] as const;
export type ShopSealShape = (typeof SHOP_SEAL_SHAPES)[number];
export const SHOP_SEAL_SHAPE_LABELS: Record<ShopSealShape, string> = {
  shield: 'Horizontal shield', oval: 'Oval', rectangle: 'Rectangle',
};
export type ShopTemplateData = { tier: 'shop'; motif: StampMotif } & (
  { template?: undefined; shape?: undefined } |
  { template: 'shop-seal-v1'; shape: ShopSealShape }
);

/** Both the frozen legacy motif and the explicit new template survive snapshots. */
export function decodeShopTemplate(value: unknown): ShopTemplateData {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('Invalid shop template');
  const t = value as Record<string, unknown>;
  if (t.tier !== 'shop' || !STAMP_MOTIFS.includes(t.motif as StampMotif)) throw Error('Invalid shop template');
  if (t.template === undefined && t.shape === undefined) return {tier: 'shop', motif: t.motif as StampMotif};
  if (t.template !== 'shop-seal-v1' || !SHOP_SEAL_SHAPES.includes(t.shape as ShopSealShape)) throw Error('Invalid shop template');
  return {tier: 'shop', motif: t.motif as StampMotif, template: 'shop-seal-v1', shape: t.shape as ShopSealShape};
}

export function initialShopSeal(key: string): {shape: ShopSealShape; ink: StampInk} {
  let hash = 0x811c9dc5;
  for (const char of `shape:stamp-${key}`) hash = Math.imul(hash ^ char.charCodeAt(0), 0x01000193) >>> 0;
  return {shape: SHOP_SEAL_SHAPES[hash % SHOP_SEAL_SHAPES.length]!, ink: inkForStampKey(`stamp-${key}`)};
}

/** Called only by an explicit editor click. Both choices change, even at RNG boundaries. */
export function randomiseShopSeal(current: {shape: ShopSealShape; ink: StampInk}, random = Math.random) {
  const shapes = SHOP_SEAL_SHAPES.filter(shape => shape !== current.shape);
  const inks = STAMP_INKS.filter(ink => ink !== current.ink);
  const pick = <T,>(values: readonly T[]) => values[Math.min(values.length - 1, Math.max(0, Math.floor(random() * values.length)))]!;
  return {shape: pick(shapes), ink: pick(inks)};
}
