"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { Icon } from "@/src/components/ui/Icon";
import {
  decodeExploreContext,
  EXPLORE_CONTEXT_PARAM,
} from "@/src/features/explore/explore-context";

const PASSPORT_ROOT = "/passport";

/**
 * The one query parameter that travels back into the Passport.
 *
 * A stamp opened from a locality's second page has to return to that page, and
 * the route alone cannot say which page. The anchor is a collection id, so it is
 * whitelisted by name and re-encoded rather than passed through: nothing else
 * from the incoming URL is echoed into the link.
 */
export const PASSPORT_ANCHOR_PARAM = "stamp";

/**
 * A base that cannot be reached, so anything absolute or protocol-relative
 * resolves to a different origin and is rejected below.
 */
const INTERNAL_BASE = "https://passport.invalid";

/**
 * Where a `?from=passport` shop page sends the reader back to.
 *
 * Validated rather than trusted: only a path inside `/passport` is honoured, and
 * only the Passport's own anchor parameter survives, so a crafted link cannot
 * turn the back control into a redirect to somewhere else.
 */
export function passportReturnHref(back: string | null | undefined): string {
  if (!back) {
    return PASSPORT_ROOT;
  }

  let url: URL;

  try {
    url = new URL(back, INTERNAL_BASE);
  } catch {
    return PASSPORT_ROOT;
  }

  // `//evil.example/x` and `https://evil.example` both land here.
  if (url.origin !== INTERNAL_BASE) {
    return PASSPORT_ROOT;
  }

  const path = url.pathname;

  // `/passportfoo` merely starts with the same letters. `..` is normalised away
  // by `URL` before this, and the prefix check is what then refuses the result.
  if (path !== PASSPORT_ROOT && !path.startsWith(`${PASSPORT_ROOT}/`)) {
    return PASSPORT_ROOT;
  }

  const anchor = url.searchParams.get(PASSPORT_ANCHOR_PARAM);

  return anchor
    ? `${path}?${PASSPORT_ANCHOR_PARAM}=${encodeURIComponent(anchor)}`
    : path;
}

/** Adds the page anchor to a Passport route, for a link that comes back to it. */
export function passportHrefWithAnchor(
  path: string,
  collectionId: string | null | undefined,
): string {
  return collectionId
    ? `${path}?${PASSPORT_ANCHOR_PARAM}=${encodeURIComponent(collectionId)}`
    : path;
}

export function mapReturnHref(shopSlug: string, context: string | null | undefined): string {
  const params = new URLSearchParams({ shop: shopSlug });

  if (context && decodeExploreContext(context)) {
    params.set(EXPLORE_CONTEXT_PARAM, context);
  }

  return `/?${params.toString()}`;
}

/**
 * Return context for a shop page.
 *
 * A shop reached from a Passport impression goes back to Passport, which reopens
 * in the mode the reader chose and at the spread, page or scroll position they
 * left; a shop reached from Saved mode goes back to Saved; anything else goes
 * back to the map with the shop still selected. The stable `/shops/[slug]` URL
 * stays canonical either way — `from` only decides where the one back control
 * points, and `back` decides how precisely.
 */
export function ShopBackLink({
  className,
  shopSlug,
}: {
  readonly className?: string | undefined;
  readonly shopSlug: string;
}) {
  const params = useSearchParams();
  const from = params?.get("from");

  const target =
    from === "passport"
      ? { href: passportReturnHref(params?.get("back")), label: "Back to Passport" }
      : from === "saved"
        ? { href: "/saved", label: "Back to saved shops" }
        : {
            href: mapReturnHref(shopSlug, params?.get(EXPLORE_CONTEXT_PARAM)),
            label: "Back to map",
          };

  return (
    <Link className={className} href={target.href}>
      <Icon name="chevron-left" size={16} />
      {target.label}
    </Link>
  );
}
