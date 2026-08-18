"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Icon, type IconName } from "@/src/components/ui/Icon";

interface NavItem {
  readonly href: string;
  readonly label: string;
  readonly icon: IconName;
}

export const NAV_ITEMS: readonly NavItem[] = [
  { href: "/", label: "Map", icon: "locate" },
  { href: "/discover", label: "Discover", icon: "search" },
  { href: "/passport", label: "Passport", icon: "seal" },
  { href: "/saved", label: "Saved", icon: "bookmark" },
];

export function isActive(pathname: string, href: string): boolean {
  if (href === "/") {
    return pathname === "/";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
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
        const active = isActive(pathname, item.href);

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
