import type { ShopSourceRef } from "@/src/domain/shop-detail";

/**
 * The one provenance line a normal tester sees.
 *
 * `docs/milestone-1-5-product-refinement.md` accepted decision 1 keeps exactly
 * one subordinate provenance sentence on the shop page and moves the per-field
 * source list, its `confirms` breakdown, and its retrieval dates into reviewer
 * mode.
 *
 * The first WP1 attempt named only the highest-ranked source, which was wrong
 * for mixed records: TY Lee's own website confirms nothing but its local-script
 * name, while the name, address and district come from a community list, so
 * "Details from the shop's own website" claimed official backing for facts that
 * do not have it. The sentence therefore names **every** source kind the record
 * rests on. Kinds, not labels — that is what keeps it a sentence rather than the
 * source dump reviewer mode already provides.
 */
const SOURCE_PHRASES: Record<ShopSourceRef["kind"], string> = {
  official: "the shop's own website",
  brand_dealer_list: "a brand's dealer listing",
  community_list: "a community shop list",
  founder_visit: "a Nib Atlas visit",
  demo_fixture: "demo fixture evidence",
};

/**
 * Reading order for the sentence: strongest backing first.
 *
 * A shop's own website outranks a dealer listing, which outranks a community
 * list. A founder visit is last not because it is weak but because it describes
 * how Nib Atlas works rather than where a published fact came from.
 */
const SOURCE_ORDER: readonly ShopSourceRef["kind"][] = [
  "official",
  "brand_dealer_list",
  "community_list",
  "founder_visit",
  "demo_fixture",
];

// Reuse only locale configuration, never shop data. Constructing an ICU
// formatter for every source date adds CPU work to each public page render.
let checkedOnFormatter: Intl.DateTimeFormat | undefined;

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

  // `Date` accepts 2026-02-31 and rolls it into March, which would print a date
  // no source was read on. Round-tripping catches that.
  if (parsed.toISOString().slice(0, 10) !== `${year}-${month}-${day}`) {
    return null;
  }

  checkedOnFormatter ??= new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

  return checkedOnFormatter.format(parsed);
}

/** The distinct source kinds a record rests on, strongest first. */
export function sourceKindsInOrder(
  sources: readonly ShopSourceRef[],
): readonly ShopSourceRef["kind"][] {
  const present = new Set(sources.map((source) => source.kind));

  return SOURCE_ORDER.filter((kind) => present.has(kind));
}

/**
 * The distinct readable retrieval dates, oldest first.
 *
 * Unparseable dates are dropped rather than guessed at: a date that cannot be
 * printed cannot be claimed. Distinct, because whether the sources agree is what
 * decides how the sentence may word its date — see {@link provenanceSentence}.
 */
export function retrievalDates(sources: readonly ShopSourceRef[]): readonly string[] {
  const dates = new Set(
    sources
      .map((source) => source.retrievedOn.trim())
      .filter((date) => formatCheckedOn(date) !== null),
  );

  return [...dates].sort((a, b) => a.localeCompare(b));
}

/**
 * The date the record can honestly claim.
 *
 * The **oldest** retrieval among the named sources, because a page is only as
 * current as its stalest fact. Pen House's website was read in August but its
 * district came from a March visit note, so claiming August would present the
 * whole record as five months fresher than part of it is.
 */
export function oldestRetrievedOn(
  sources: readonly ShopSourceRef[],
): string | undefined {
  return retrievalDates(sources)[0];
}

/** `A`, `A and B`, `A, B, and C`. */
function sentenceList(items: readonly string[]): string {
  if (items.length <= 1) {
    return items[0] ?? "";
  }

  if (items.length === 2) {
    return `${items[0]} and ${items[1]}`;
  }

  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

/**
 * Builds the sentence, or returns `null` when there is nothing honest to say.
 *
 * A record with no source gets no line rather than a vague one — inventing
 * provenance is worse than omitting it.
 *
 * The date clause has to say what the date it prints actually means. The
 * conservative policy is unchanged — the oldest retrieval, because a page is
 * only as current as its stalest fact — but "checked 16 March 2026" on a record
 * whose website was read in August states something untrue about the website.
 * So the wording follows the sources:
 *
 * - **one date across every source** — "…, checked 26 August 2026." Nothing is
 *   qualified because nothing needs qualifying.
 * - **dates that differ** — "…; oldest source checked 16 March 2026." The
 *   reader learns the floor on the record's freshness and is not told that
 *   every part of it was read then.
 * - **no readable date** — no clause at all.
 *
 * Still one subordinate sentence either way. The per-source dates stay in
 * reviewer mode, where the full list already carries them.
 */
export function provenanceSentence(sources: readonly ShopSourceRef[]): string | null {
  const kinds = sourceKindsInOrder(sources);

  if (kinds.length === 0) {
    return null;
  }

  const phrase = sentenceList(kinds.map((kind) => SOURCE_PHRASES[kind]));
  const dates = retrievalDates(sources);
  const oldest = dates[0] === undefined ? null : formatCheckedOn(dates[0]);

  if (oldest === null) {
    return `Details from ${phrase}.`;
  }

  return dates.length === 1
    ? `Details from ${phrase}, checked ${oldest}.`
    : `Details from ${phrase}; oldest source checked ${oldest}.`;
}
