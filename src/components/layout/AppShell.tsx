"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { NibAtlasMark } from "@/src/components/brand/NibAtlasMark";
import { PrimaryNav } from "@/src/components/layout/PrimaryNav";
import { PrototypeBadge } from "@/src/components/ui/StatusBadge";

import styles from "./AppShell.module.css";

type ShellVariant = "map" | "passport" | "content";

/** Map and its Saved mode take the full mobile canvas; Passport needs an
 *  uninterrupted field to sit its book in; everything else keeps the header. */
function variantFor(pathname: string): ShellVariant {
  if (pathname === "/" || pathname === "/saved") {
    return "map";
  }

  if (pathname === "/passport" || pathname.startsWith("/passport/")) {
    return "passport";
  }

  return "content";
}

export function AppShell({ children }: { readonly children: ReactNode }) {
  const pathname = usePathname() ?? "/";
  const variant = variantFor(pathname);

  return (
    <div className={styles.shell} data-shell-variant={variant}>
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <header
        className={`${styles.header} ${variant === "map" ? styles.headerMapVariant : ""}`}
      >
        <Link className={styles.brand} href="/">
          <NibAtlasMark size={28} title="Nib Atlas" />
          <span className={styles.brandName}>Nib Atlas</span>
        </Link>
        <PrimaryNav
          variant="inline"
          className={styles.desktopNav}
          itemClassName={styles.desktopNavItem}
        />
        <span className={styles.headerSpacer} />
        <PrototypeBadge>Prototype data</PrototypeBadge>
      </header>

      <main
        id="main-content"
        className={`${styles.main} ${
          variant === "content" ? styles.mainContentVariant : styles.mainFullVariant
        }`}
      >
        {children}
      </main>

      <PrimaryNav
        variant="bottom"
        className={styles.bottomNav}
        itemClassName={styles.navItem}
        markerClassName={styles.navMarker}
      />
    </div>
  );
}
