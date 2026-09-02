import type {
  ShopDetail,
  ShopSourceRef,
  SourcedClaim,
} from "@/src/domain/shop-detail";

/**
 * The rule that keeps WP4's value layer honest.
 *
 * Accepted decision 4 lets Claude Code define the pen-specific schema and forbids
 * it inventing the content. A schema alone cannot enforce that, so every
 * pen-specific claim carries `confirmedBy` — the stable `id` of one of the record's
 * own `sources` entries — and this module checks two things, not one:
 *
 * 1. the reference resolves to a source actually attached to the record, and
 * 2. **that source's own `confirms` list covers this specific claim.**
 *
 * The second check is the one the first WP4 attempt was missing, and the reason
 * it mattered is concrete: TY Lee's official source confirms only
 * `Local-script name`, so label-existence alone would have let a nib-grinding
 * service cite it and publish. Access and practical facts are checked **per
 * populated field** for the same reason — one confirmed station never vouches for
 * a payment method or a spoken language.
 *
 * It reuses the evidence registry that already exists rather than adding a
 * second one: `ShopSourceRef` is the shared evidence identity, `confirms` is still
 * the field-level evidence list, and reviewer mode still renders the whole list
 * with its retrieval dates.
 *
 * What is new is that a pen-specific claim's entry in `confirms` has a canonical
 * form, produced by the token helpers below. Data and validator derive the token
 * the same way from the same helper, so support is a lookup rather than a
 * substring guess — and the tokens stay readable English, because reviewer mode
 * prints them verbatim.
 */

/** Evidence tokens for the fields of an access block. */
export const ACCESS_EVIDENCE_TOKENS = {
  nearestStation: "Nearest station",
  walkFromStation: "Walking time from station",
  floorNote: "Floor or building note",
  accessibilityNote: "Accessibility",
} as const;

/** Evidence tokens for the fields of a practical block. */
export const PRACTICAL_EVIDENCE_TOKENS = {
  paymentMethods: "Payment methods",
  languages: "Languages spoken",
  appointmentRequired: "Appointment requirement",
} as const;

export function serviceEvidenceToken(label: string): string {
  return `Service: ${label}`;
}

export function experienceEvidenceToken(label: string): string {
  return `Experience: ${label}`;
}

export function exclusiveEvidenceToken(label: string): string {
  return `Only here: ${label}`;
}

/**
 * Compared case- and whitespace-insensitively.
 *
 * A record hand-edited to `service: nib alignment & tuning` means the same thing
 * as `Service: Nib alignment & tuning`, and failing it would be pedantry rather
 * than honesty. Nothing looser than this: no substring or prefix matching, so a
 * source confirming `Languages of the website` can never be read as confirming
 * the languages spoken at the counter.
 */
function normalise(token: string): string {
  return token.trim().replace(/\s+/g, " ").toLowerCase();
}

function confirmsSet(source: ShopSourceRef): ReadonlySet<string> {
  return new Set(source.confirms.map(normalise));
}

/** Why a claim was rejected. */
export type EvidenceFailure =
  /** `confirmedBy` names no source attached to this record. */
  | "unknown-source"
  /** The source exists, but its `confirms` list does not cover this claim. */
  | "claim-not-confirmed";

/** One claim whose evidence does not hold. */
export interface EvidenceIssue {
  /** Where the claim sits: `services[0]`, `access.nearestStation`. */
  readonly path: string;
  /** The evidence token the source had to confirm. */
  readonly token: string;
  /** The stable `ShopSourceRef.id` the claim pointed at. */
  readonly confirmedBy: string;
  readonly failure: EvidenceFailure;
}

/**
 * Checks one claim against the source it names.
 *
 * Returns an empty array when the named source exists **and** confirms the
 * claim's own token; otherwise the single issue explaining which half failed.
 */
export function sourceEvidenceFailure(
  sources: readonly ShopSourceRef[],
  confirmedBy: string,
  token: string,
): EvidenceFailure | null {
  const source = sources.find((entry) => entry.id === confirmedBy);

  if (source === undefined) {
    return "unknown-source";
  }

  return confirmsSet(source).has(normalise(token)) ? null : "claim-not-confirmed";
}

function claimIssues(
  shop: ShopDetail,
  path: string,
  token: string,
  claim: SourcedClaim,
): readonly EvidenceIssue[] {
  const failure = sourceEvidenceFailure(shop.sources, claim.confirmedBy, token);

  if (failure !== null) {
    return [
      { path, token, confirmedBy: claim.confirmedBy, failure },
    ];
  }

  return [];
}

/**
 * Every unsupported pen-specific claim on a record.
 *
 * An empty array is the only acceptable result. The catalogue test asserts it for
 * every shop, so a claim can never reach a shop page unless the source that backs
 * it travels with the record *and* says it backs that claim.
 */
export function shopEvidenceIssues(shop: ShopDetail): readonly EvidenceIssue[] {
  const issues: EvidenceIssue[] = [];

  (shop.services ?? []).forEach((service, index) => {
    issues.push(
      ...claimIssues(
        shop,
        `services[${index}]`,
        serviceEvidenceToken(service.label),
        service,
      ),
    );
  });

  (shop.experiences ?? []).forEach((experience, index) => {
    issues.push(
      ...claimIssues(
        shop,
        `experiences[${index}]`,
        experienceEvidenceToken(experience.label),
        experience,
      ),
    );
  });

  (shop.exclusives ?? []).forEach((exclusive, index) => {
    issues.push(
      ...claimIssues(
        shop,
        `exclusives[${index}]`,
        exclusiveEvidenceToken(exclusive.label),
        exclusive,
      ),
    );
  });

  // Per populated field, in a fixed order so a failure list reads the same way
  // every run. An absent field is not checked; a present one is checked against
  // its own token and its own source.
  const access = shop.access;

  if (access) {
    for (const field of [
      "nearestStation",
      "walkFromStation",
      "floorNote",
      "accessibilityNote",
    ] as const) {
      const claim = access[field];

      if (claim) {
        issues.push(
          ...claimIssues(
            shop,
            `access.${field}`,
            ACCESS_EVIDENCE_TOKENS[field],
            claim,
          ),
        );
      }
    }
  }

  const practical = shop.practical;

  if (practical) {
    for (const field of [
      "paymentMethods",
      "languages",
      "appointmentRequired",
    ] as const) {
      const claim = practical[field];

      if (claim) {
        issues.push(
          ...claimIssues(
            shop,
            `practical.${field}`,
            PRACTICAL_EVIDENCE_TOKENS[field],
            claim,
          ),
        );
      }
    }
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
