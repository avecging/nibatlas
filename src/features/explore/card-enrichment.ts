import { demoShopDetails } from "@/src/fixtures/demo-catalogue";

/**
 * Presentation-only enrichment for Milestone 1.
 *
 * `UX.md` asks the shop card for one useful specialty or service line, but the
 * shared `ShopMapSummary` projection does not carry one yet. The demo catalogue
 * supplies it here so no component depends on a provider shape. The PR requests
 * a single `specialtyLine` field on the Milestone 2 viewport projection so this
 * lookup can be deleted.
 */
const SPECIALTY_LINES = new Map(
  demoShopDetails.map((shop) => [
    shop.slug,
    shop.specialties[0] ?? shop.services[0] ?? null,
  ]),
);

export function specialtyLineFor(slug: string): string | null {
  return SPECIALTY_LINES.get(slug) ?? null;
}
