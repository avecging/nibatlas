/**
 * Contribution routing.
 *
 * WP7 replaces the `mailto:` destinations accepted decision 8 fixed with real
 * pages: `/suggest-shop`, and a correction form under the listing it corrects.
 *
 * **The email routes stay, and are not vestigial.** They are what a form offers
 * when it cannot deliver — an address has no service behind it to be
 * unavailable — so they remain the fallback on both flows and are asserted as
 * such. Nothing else links to them.
 *
 * `encodeURIComponent`, not `URLSearchParams`: the latter encodes a space as
 * `+`, which several mail clients paste into the subject line literally. `%20`
 * is understood everywhere.
 */
export const CONTRIBUTE_EMAIL = "hello@nibatlas.com";

/** The exact subject tags from accepted decision 8. */
export const SUGGEST_SHOP_SUBJECT = "[Suggest shop]";
export const SHOP_CORRECTION_SUBJECT = "[Shop correction]";

export function mailtoHref({
  to,
  subject,
}: {
  readonly to: string;
  readonly subject: string;
}): string {
  return `mailto:${to}?subject=${encodeURIComponent(subject)}`;
}

/** Suggest a pen shop. */
export const SUGGEST_SHOP_PATH = "/suggest-shop";

/** Help: how the product works, and the questions it is actually asked. */
export const HELP_PATH = "/help";

/**
 * The correction form for one listing.
 *
 * The shop is in the path, not in a query parameter the reader could edit into
 * something meaningless, and the page resolves the name from it. Accepted
 * decision 8 asks that a correction name the relevant shop; carrying the slug is
 * how it does that without asking anyone to type it.
 */
export function shopCorrectionPath(slug: string): string {
  return `/shops/${slug}/report`;
}

/** The email fallback, used when a submission cannot be delivered. */
export function suggestShopHref(): string {
  return mailtoHref({ to: CONTRIBUTE_EMAIL, subject: SUGGEST_SHOP_SUBJECT });
}

/**
 * The correction email fallback, naming the shop so a reply is actionable.
 */
export function shopCorrectionHref(shopName?: string): string {
  return mailtoHref({
    to: CONTRIBUTE_EMAIL,
    subject: shopName
      ? `${SHOP_CORRECTION_SUBJECT} ${shopName}`
      : SHOP_CORRECTION_SUBJECT,
  });
}
