"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { Icon } from "@/src/components/ui/Icon";

/**
 * Return context for a shop page.
 *
 * A shop reached from a Passport impression goes back to Passport, which reopens
 * in the mode the reader chose and at the spread or scroll position they left; a
 * shop reached from Saved mode goes back to Saved; anything else goes back to the
 * map with the shop still selected. The stable `/shops/[slug]` URL stays
 * canonical either way — `from` only decides where the one back control points.
 *
 * `back` narrows that further, so a stamp opened from `/passport/jp/ginza`
 * returns to Ginza rather than to the overview. It is validated rather than
 * trusted: only a path inside `/passport` is honoured, so a crafted link cannot
 * turn the back control into a redirect to somewhere else.
 */
const PASSPORT_ROOT = "/passport";

export function passportReturnHref(back: string | null | undefined): string {
  if (!back) {
    return PASSPORT_ROOT;
  }

  // A protocol-relative or absolute URL would leave the application; a path that
  // merely starts with the same letters ("/passportfoo") is not a Passport route.
  if (
    !back.startsWith(`${PASSPORT_ROOT}/`) &&
    back !== PASSPORT_ROOT
  ) {
    return PASSPORT_ROOT;
  }

  if (back.includes("//") || back.includes("..")) {
    return PASSPORT_ROOT;
  }

  return back;
}

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
        : { href: `/?shop=${shopSlug}`, label: "Back to map" };

  return (
    <Link className={className} href={target.href}>
      <Icon name="chevron-left" size={16} />
      {target.label}
    </Link>
  );
}
