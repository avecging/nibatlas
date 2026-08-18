"use client";

import { useEffect, useRef, useState } from "react";

import { StampArt } from "@/src/components/stamps/StampArt";
import { Button, ButtonLink } from "@/src/components/ui/Button";
import type { StampCollection } from "@/src/domain/passport";

import styles from "./StampCeremony.module.css";

interface StampCeremonyProps {
  readonly collection: StampCollection;
  readonly alreadyCollected: boolean;
  readonly passportHref: string;
  readonly onClose: () => void;
}

function usesReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) {
    return false;
  }

  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function StampCeremony({
  collection,
  alreadyCollected,
  passportHref,
  onClose,
}: StampCeremonyProps) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const [phase, setPhase] = useState<"pressing" | "settled">(
    alreadyCollected || usesReducedMotion() ? "settled" : "pressing",
  );

  useEffect(() => {
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();

    return () => previouslyFocused.current?.focus();
  }, []);

  useEffect(() => {
    if (phase !== "pressing") {
      return;
    }

    const timer = setTimeout(() => setPhase("settled"), 800);

    return () => clearTimeout(timer);
  }, [phase]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
        return;
      }

      if (event.key !== "Tab" || !dialogRef.current) {
        return;
      }

      const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );

      if (focusable.length === 0) {
        return;
      }

      const first = focusable[0] as HTMLElement;
      const last = focusable[focusable.length - 1] as HTMLElement;

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div className={styles.backdrop} data-testid="stamp-ceremony">
      <div
        ref={dialogRef}
        className={`${styles.dialog} ${phase === "pressing" ? styles.pressing : styles.settled}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="stamp-ceremony-title"
        tabIndex={-1}
      >
        <h2 className={styles.title} id="stamp-ceremony-title">
          {alreadyCollected ? "Already in your Passport" : "Impression collected"}
        </h2>
        <p className={styles.lede}>
          Simulated collection. Milestone 1 does not use your location and issues no
          real stamp.
        </p>
        <div className={styles.stage}>
          <div className={styles.impression}>
            <StampArt
              stamp={collection.stamp}
              shopName={collection.shopNameSnapshot}
              collectedOn={collection.collectedOn}
            />
          </div>
          <p className={styles.meta} role="status">
            {collection.shopNameSnapshot} · {collection.localityName},{" "}
            {collection.countryLabel} · {collection.collectedOn} (
            {collection.shopTimezone})
          </p>
        </div>
        <div className={styles.actions}>
          <ButtonLink href={passportHref} variant="primary" fullWidth>
            Open in Passport
          </ButtonLink>
          <Button variant="quiet" fullWidth onClick={onClose}>
            Back to shop
          </Button>
        </div>
      </div>
    </div>
  );
}
