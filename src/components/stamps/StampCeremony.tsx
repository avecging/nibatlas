"use client";

import { useEffect, useState } from "react";

import { useDialogFocus } from "@/src/components/hooks/useDialogFocus";
import { StampArt } from "@/src/components/stamps/StampArt";
import { Button, ButtonLink } from "@/src/components/ui/Button";
import type { StampCollection } from "@/src/domain/passport";

import styles from "./StampCeremony.module.css";

/** Poised, press, settle, date. 780 ms end to end, inside the 600-900 ms band. */
const CEREMONY_MS = 780;

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

/**
 * The collection ceremony.
 *
 * Restrained by instruction: a poised stamp, a short press, the ink settling,
 * and then the place and date. No confetti, no points, no rarity reveal, no
 * streak, and no reward language anywhere in the copy.
 *
 * Under reduced motion the completed impression is simply there, with a fade
 * under 150 ms and no press at all.
 */
export function StampCeremony({
  collection,
  alreadyCollected,
  passportHref,
  onClose,
}: StampCeremonyProps) {
  const dialogRef = useDialogFocus<HTMLDivElement>(true, onClose);
  const reduced = usesReducedMotion();
  const pressing = !alreadyCollected && !reduced;
  const [phase, setPhase] = useState<"pressing" | "settled">(
    pressing ? "pressing" : "settled",
  );

  useEffect(() => {
    if (phase !== "pressing") {
      return;
    }

    // One soft haptic cue, only where the platform supports it. Never a
    // requirement, and never repeated.
    try {
      navigator.vibrate?.(12);
    } catch {
      // Unsupported or blocked; the ceremony does not depend on it.
    }

    const timer = setTimeout(() => setPhase("settled"), CEREMONY_MS);

    return () => clearTimeout(timer);
  }, [phase]);

  return (
    <div className={styles.backdrop} data-testid="stamp-ceremony">
      <div
        ref={dialogRef}
        className={styles.dialog}
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

        <div
          className={styles.plate}
          data-phase={phase}
          data-reduced={reduced ? "true" : "false"}
        >
          <span className={styles.paper} aria-hidden="true" />
          <span className={styles.contactShadow} aria-hidden="true" />
          <div className={styles.impression}>
            <StampArt
              stamp={collection.stamp}
              title={collection.shopNameSnapshot}
              {...(collection.shopLocalNameSnapshot === undefined
                ? {}
                : { localTitle: collection.shopLocalNameSnapshot })}
              subtitle={collection.collectedOn}
            />
          </div>
          <span className={styles.pressFlash} aria-hidden="true" />
        </div>

        <p className={styles.meta} role="status">
          {collection.shopNameSnapshot} · {collection.localityName},{" "}
          {collection.countryLabel} · {collection.collectedOn} (
          {collection.shopTimezone})
        </p>

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
