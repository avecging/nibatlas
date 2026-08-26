/**
 * Reviewer mode: the seam between the product and its instrumentation.
 *
 * Milestone 1 shipped one surface for two audiences. Prototype badges, the word
 * "simulated", milestone chips, coverage-set versions and coordinate precision
 * are all scaffolding for the founder and Codex, and a non-technical tester
 * cannot tell them from the product. Reviewer mode splits the two: the default
 * experience is the product, and everything that explains the implementation is
 * behind a per-device flag.
 *
 * The rules, from `docs/milestone-1-5-product-refinement.md` accepted decision 3:
 *
 * - `?review=1` enables reviewer mode and remembers it on that device.
 * - `?review=0` disables it and remembers that.
 * - With neither parameter, the remembered choice applies.
 * - A device that has never chosen defaults to off.
 *
 * This module is deliberately pure so the resolution rules can be tested
 * without a browser. `ReviewerModeProvider` owns the storage and the URL.
 */

/** Query parameter that switches the mode. */
export const REVIEWER_QUERY_PARAM = "review";

/**
 * Local storage, not session storage: the choice has to survive a reload and a
 * new tab, or a reviewer would have to re-append the parameter constantly.
 */
export const REVIEWER_STORAGE_KEY = "nib-atlas.reviewer-mode.v1";

const ENABLED_VALUES = new Set(["1", "true", "on", "yes"]);
const DISABLED_VALUES = new Set(["0", "false", "off", "no"]);

/**
 * Reads the query parameter.
 *
 * Returns `null` for an absent or unrecognised value so the caller can fall
 * through to the remembered choice rather than treating nonsense as a decision.
 */
export function parseReviewerParam(value: string | null | undefined): boolean | null {
  if (value === null || value === undefined) {
    return null;
  }

  const normalized = value.trim().toLowerCase();

  if (ENABLED_VALUES.has(normalized)) {
    return true;
  }

  if (DISABLED_VALUES.has(normalized)) {
    return false;
  }

  return null;
}

/** Reads a persisted choice written by {@link serializeReviewerChoice}. */
export function parseStoredReviewerChoice(
  value: string | null | undefined,
): boolean | null {
  return parseReviewerParam(value);
}

export function serializeReviewerChoice(enabled: boolean): string {
  return enabled ? "1" : "0";
}

/**
 * The whole rule in one function: an explicit parameter wins, a remembered
 * choice comes next, and a device that has never chosen gets the product.
 */
export function resolveReviewerMode({
  param,
  stored,
}: {
  readonly param: boolean | null;
  readonly stored: boolean | null;
}): boolean {
  if (param !== null) {
    return param;
  }

  if (stored !== null) {
    return stored;
  }

  return false;
}

/** Pulls the parameter out of a `location.search` string. */
export function reviewerParamFromSearch(search: string): boolean | null {
  const query = search.startsWith("?") ? search.slice(1) : search;

  return parseReviewerParam(new URLSearchParams(query).get(REVIEWER_QUERY_PARAM));
}
