"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { NibAtlasMark } from "@/src/components/brand/NibAtlasMark";
import { PrimaryNav } from "@/src/components/layout/PrimaryNav";
import { DemoBadge } from "@/src/components/ui/StatusBadge";

import styles from "./AppShell.module.css";

/**
 * The map route gets the full mobile canvas above the navigation; every other
 * route keeps the header for orientation.
 */
export function AppShell({ children }: { readonly children: ReactNode }) {
  const pathname = usePathname() ?? "/";
  const variant = pathname === "/" ? "map" : "content";

  return (
    <div className={styles.shell}>
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
        <DemoBadge>Demo · not production data</DemoBadge>
      </header>

      <main
        id="main-content"
        className={`${styles.main} ${
          variant === "map" ? styles.mainMapVariant : styles.mainContentVariant
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
