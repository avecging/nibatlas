import type {
  ShopAccessNote,
  ShopDetail,
  ShopExclusive,
  ShopExperience,
  ShopPracticalInfo,
  ShopService,
  SourcedClaim,
} from "@/src/domain/shop-detail";

/**
 * The rule that keeps WP4's value layer honest.
 *
 * Accepted decision 4 lets Claude Code define the pen-specific schema and
 * forbids it inventing the content. A schema alone cannot enforce that, so every
 * pen-specific claim carries `confirmedBy` — the `label` of one of the record's
 * own `sources` entries — and this module is what checks the reference resolves.
 *
 * It reuses the evidence registry that already exists rather than adding a
 * second one: the source list, its retrieval dates and its `confirms` breakdown
 * are unchanged, and reviewer mode still renders them.
 */

/** One claim whose evidence reference does not resolve. */
export interface EvidenceIssue {
  /** Where the claim sits: `services[0]`, `access`, `practical`. */
  readonly path: string;
  /** What the claim says, for a legible failure message. */
  readonly claim: string;
  /** The unresolved `ShopSourceRef.label` the claim pointed at. */
  readonly confirmedBy: string;
}

function claimIssues(
  shop: ShopDetail,
  path: string,
  claim: string,
  entry: SourcedClaim,
): readonly EvidenceIssue[] {
  const resolved = shop.sources.some(
    (source) => source.label === entry.confirmedBy,
  );

  return resolved
    ? []
    : [{ path, claim, confirmedBy: entry.confirmedBy }];
}

/** Names an access or practical block well enough to read in a failure. */
function summarise(parts: readonly (string | undefined)[]): string {
  return parts.filter((part) => part !== undefined && part !== "").join(" · ");
}

function accessSummary(access: ShopAccessNote): string {
  return summarise([
    access.nearestStation,
    access.walkFromStation,
    access.floorNote,
    access.accessibilityNote,
  ]);
}

function practicalSummary(practical: ShopPracticalInfo): string {
  return summarise([
    practical.paymentMethods?.join(", "),
    practical.languages?.join(", "),
    practical.appointmentRequired === undefined
      ? undefined
      : `appointment required: ${practical.appointmentRequired}`,
  ]);
}

/**
 * Every unsupported pen-specific claim on a record.
 *
 * An empty array is the only acceptable result. The catalogue test asserts it
 * for every shop, so a claim can never reach a shop page without the source
 * that backs it travelling with the record.
 */
export function shopEvidenceIssues(shop: ShopDetail): readonly EvidenceIssue[] {
  const issues: EvidenceIssue[] = [];

  (shop.services ?? []).forEach((service: ShopService, index) => {
    issues.push(...claimIssues(shop, `services[${index}]`, service.label, service));
  });

  (shop.experiences ?? []).forEach((experience: ShopExperience, index) => {
    issues.push(
      ...claimIssues(shop, `experiences[${index}]`, experience.label, experience),
    );
  });

  (shop.exclusives ?? []).forEach((exclusive: ShopExclusive, index) => {
    issues.push(
      ...claimIssues(shop, `exclusives[${index}]`, exclusive.label, exclusive),
    );
  });

  if (shop.access) {
    issues.push(
      ...claimIssues(shop, "access", accessSummary(shop.access), shop.access),
    );
  }

  if (shop.practical) {
    issues.push(
      ...claimIssues(shop, "practical", practicalSummary(shop.practical), shop.practical),
    );
  }

  return issues;
}

/**
 * Whether the record answers "what can I do there?" at all.
 *
 * Services, in-store experiences and shop-only items are the layer that makes a
 * page a hobby guide rather than a directory entry. A record carrying none of
 * them cannot answer the question the page exists to answer, and that is the one
 * gap WP4 speaks about rather than silently omitting.
 */
export function hasSourcedValueLayer(shop: ShopDetail): boolean {
  return (
    (shop.services ?? []).length > 0 ||
    (shop.experiences ?? []).length > 0 ||
    (shop.exclusives ?? []).length > 0
  );
}

/**
 * The one caution a material gap earns.
 *
 * Ordinary unsupported fields are omitted in silence — an address, a payment
 * method, a language. This is the exception `docs/milestone-1-5-product-refinement.md`
 * accepted decision 1 allows: not knowing what a visitor can *do* at a shop is
 * the gap that changes whether the trip is worth making, so it is stated once,
 * concisely, and paired with the contribution invitation rather than an apology.
 */
export const MATERIAL_GAP_CAUTION =
  "We have not confirmed what you can do at this shop — services, in-store experiences, or anything sold only here.";

export const CONTRIBUTION_INVITATION = "Know this shop? Help us improve this listing.";
