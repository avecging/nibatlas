import type { ShopSourceRef } from "@/src/domain/shop-detail";

/**
 * The one provenance line a normal tester sees.
 *
 * `docs/milestone-1-5-product-refinement.md` accepted decision 1 keeps exactly
 * one subordinate provenance sentence on the shop page and moves the per-field
 * source list, its `confirms` breakdown, and its retrieval dates into reviewer
 * mode. The sentence names where the facts came from and when they were read,
 * which is what a visitor can actually use; the rest is review instrumentation.
 */
const SOURCE_PHRASES: Record<ShopSourceRef["kind"], string> = {
  official: "the shop's own website",
  brand_dealer_list: "a brand's dealer listing",
  community_list: "a community shop list",
  founder_visit: "a Nib Atlas visit",
};

/**
 * Which source speaks for the record.
 *
 * A shop's own website outranks a dealer listing, which outranks a community
 * list. A founder visit is last not because it is weak but because naming it in
 * product copy would describe how Nib Atlas is run rather than where the facts
 * came from.
 */
const SOURCE_RANK: Record<ShopSourceRef["kind"], number> = {
  official: 0,
  brand_dealer_list: 1,
  community_list: 2,
  founder_visit: 3,
};

/** Formats an ISO date as the plain English the copy uses: `26 August 2026`. */
export function formatCheckedOn(retrievedOn: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(retrievedOn.trim());

  if (!match) {
    return null;
  }

  const [, year, month, day] = match;
  const parsed = new Date(`${year}-${month}-${day}T00:00:00Z`);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(parsed);
}

export function primarySource(
  sources: readonly ShopSourceRef[],
): ShopSourceRef | undefined {
  return [...sources].sort((a, b) => {
    const rank = SOURCE_RANK[a.kind] - SOURCE_RANK[b.kind];

    // Same kind: the most recently read source is the one worth naming.
    return rank !== 0 ? rank : b.retrievedOn.localeCompare(a.retrievedOn);
  })[0];
}

/**
 * Builds the sentence, or returns `null` when there is nothing honest to say.
 *
 * A record with no source gets no line rather than a vague one — inventing
 * provenance is worse than omitting it.
 */
export function provenanceSentence(sources: readonly ShopSourceRef[]): string | null {
  const source = primarySource(sources);

  if (!source) {
    return null;
  }

  const phrase = SOURCE_PHRASES[source.kind];
  const checkedOn = formatCheckedOn(source.retrievedOn);

  return checkedOn
    ? `Details from ${phrase}, checked ${checkedOn}.`
    : `Details from ${phrase}.`;
}
