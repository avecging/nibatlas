"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Icon, type IconName } from "@/src/components/ui/Icon";

interface NavItem {
  readonly href: string;
  readonly label: string;
  readonly icon: IconName;
  /**
   * Extra routes that belong to this destination. Saved is a mode Map owns, not
   * a destination of its own, so `/saved` keeps Map marked as the current
   * section rather than leaving the navigation with nothing selected.
   */
  readonly alsoOwns?: readonly string[];
}

/**
 * Exactly three primary destinations.
 *
 * Discover is not a destination: exploring is what Map is for, and contextual
 * place prompts live inside it. Saved is not a destination either: it is a
 * global mode Map owns, reached from a labelled control on Map itself.
 */
export const NAV_ITEMS: readonly NavItem[] = [
  { href: "/", label: "Map", icon: "map", alsoOwns: ["/saved"] },
  { href: "/passport", label: "Passport", icon: "passport" },
  { href: "/me", label: "Me", icon: "person", alsoOwns: ["/privacy", "/account"] },
];

export function isActive(pathname: string, item: NavItem): boolean {
  const owned = [item.href, ...(item.alsoOwns ?? [])];

  return owned.some((href) =>
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`),
  );
}

interface PrimaryNavProps {
  readonly variant: "bottom" | "inline";
  readonly className?: string | undefined;
  readonly itemClassName?: string | undefined;
  readonly markerClassName?: string | undefined;
}

export function PrimaryNav({
  variant,
  className,
  itemClassName,
  markerClassName,
}: PrimaryNavProps) {
  const pathname = usePathname() ?? "/";

  return (
    <nav
      className={className}
      aria-label={variant === "bottom" ? "Primary" : "Primary sections"}
    >
      {NAV_ITEMS.map((item) => {
        const active = isActive(pathname, item);

        return (
          <Link
            key={item.href}
            href={item.href}
            className={itemClassName}
            aria-current={active ? "page" : undefined}
          >
            <Icon name={item.icon} size={variant === "bottom" ? 22 : 18} />
            <span>{item.label}</span>
            {variant === "bottom" && markerClassName ? (
              <span className={markerClassName} aria-hidden="true" />
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
