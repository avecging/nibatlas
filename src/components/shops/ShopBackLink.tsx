"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { Icon } from "@/src/components/ui/Icon";

/**
 * Return context for a shop page.
 *
 * A shop reached from a Passport impression goes back to Passport, which reopens
 * at the page the reader left; a shop reached from Saved mode goes back to Saved;
 * anything else goes back to the map with the shop still selected. The stable
 * `/shops/[slug]` URL stays canonical either way — `from` only decides where the
 * one back control points.
 */
export function ShopBackLink({
  className,
  shopSlug,
}: {
  readonly className?: string | undefined;
  readonly shopSlug: string;
}) {
  const from = useSearchParams()?.get("from");

  const target =
    from === "passport"
      ? { href: "/passport", label: "Back to Passport" }
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
