"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { NibAtlasMark } from "@/src/components/brand/NibAtlasMark";
import { PrimaryNav } from "@/src/components/layout/PrimaryNav";
import { ReviewerModeBadge } from "@/src/features/reviewer/ReviewerModeBadge";
import { useReviewerMode } from "@/src/features/reviewer/ReviewerModeProvider";

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
  const reviewer = useReviewerMode();

  return (
    <div
      className={styles.shell}
      data-shell-variant={variant}
      data-reviewer-mode={reviewer ? "on" : "off"}
    >
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
        {/*
          The only chrome the shell adds beyond navigation. In normal mode the
          header carries the brand and the sections and nothing else; the
          Milestone 1 "Prototype data" badge on every screen is now part of the
          reviewer marker instead.
        */}
        <ReviewerModeBadge />
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
