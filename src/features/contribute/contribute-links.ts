/**
 * Contribution routing.
 *
 * `docs/milestone-1-5-product-refinement.md` accepted decision 8 fixes the
 * destinations until Milestone 6 builds the real flow: a pre-addressed email,
 * one subject tag per kind, and a dedicated `/suggest-shop` form later.
 *
 * The hrefs are built here rather than written inline so the address and the
 * subject tags exist once, can be asserted exactly, and can be reused by the
 * shop-page correction route when WP7 adds it.
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

/** Suggest a pen shop: the route WP2 opens. */
export function suggestShopHref(): string {
  return mailtoHref({ to: CONTRIBUTE_EMAIL, subject: SUGGEST_SHOP_SUBJECT });
}

/**
 * Report incorrect information.
 *
 * Defined here because the subject tag belongs with its sibling, but not yet
 * wired into a control: WP7 owns the correction route, which decision 8 says
 * should name the relevant shop where possible, and that context lives on the
 * shop page rather than in Me.
 */
export function shopCorrectionHref(shopName?: string): string {
  return mailtoHref({
    to: CONTRIBUTE_EMAIL,
    subject: shopName
      ? `${SHOP_CORRECTION_SUBJECT} ${shopName}`
      : SHOP_CORRECTION_SUBJECT,
  });
}
