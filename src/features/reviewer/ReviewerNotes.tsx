"use client";

import type { ReactNode } from "react";

import { useReviewerMode } from "@/src/features/reviewer/ReviewerModeProvider";

import styles from "./ReviewerNotes.module.css";

/**
 * Reviewer prose for pages that are otherwise server-rendered.
 *
 * These notes are written here, inside a client component, rather than passed as
 * children from a server page. Wrapping server-rendered children in a reviewer
 * gate would put the text into the RSC payload of every visitor — hidden in the
 * interface but present in the document. Holding the copy in the client bundle
 * keeps the shipped HTML a normal tester receives free of it entirely.
 */
function Note({ title, children }: { readonly title: string; readonly children: ReactNode }) {
  const reviewer = useReviewerMode();

  if (!reviewer) {
    return null;
  }

  return (
    <aside className={styles.note} data-testid="reviewer-note">
      <p className={styles.noteTitle}>{title}</p>
      {children}
    </aside>
  );
}

/** What the staging build actually does, on the Privacy page. */
export function PrivacyReviewerNote() {
  return (
    <Note title="Reviewer note">
      <p>
        This build is a frontend prototype: no accounts, no server, and no location
        access. It never asks the browser for a position. Saved shops and simulated
        collections are held on this device only, in this browser&rsquo;s local
        storage, and are not sent anywhere.
      </p>
      <p>
        Shop records are a small sourced sample, not a complete or continuously
        verified catalogue. This page is prototype copy for review; the binding
        policy is published before public launch.
      </p>
    </Note>
  );
}

/** Catalogue status behind the About page's product copy. */
export function AboutReviewerNote() {
  return (
    <Note title="Reviewer note">
      <p>
        The coverage figures above are counted from the Milestone 1 prototype
        catalogue fixture at build time, so they track the fixture rather than a
        live database. Country seal thresholds are evaluated against the versioned
        curated coverage sets; the applicable version is shown in Passport and Me
        while reviewer mode is on.
      </p>
    </Note>
  );
}
