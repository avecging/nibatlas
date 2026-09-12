"use client";

import { useEffect, useState } from "react";

import { useDialogFocus } from "@/src/components/hooks/useDialogFocus";
import { ImpressionPlate } from "@/src/components/stamps/ImpressionPlate";
import { ImpressionSheet } from "@/src/components/stamps/ImpressionSheet";
import { StampArt } from "@/src/components/stamps/StampArt";
import { Button, ButtonLink } from "@/src/components/ui/Button";
import type { StampCollection } from "@/src/domain/passport";
import { useReviewerMode } from "@/src/features/reviewer/ReviewerModeProvider";

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
 * The collection ceremony — and the collected impression a shop page shows.
 *
 * Restrained by instruction: a poised stamp, a short press, the ink settling,
 * and then the place and date. No confetti, no points, no rarity reveal, no
 * streak, and no reward language anywhere in the copy.
 *
 * Under reduced motion the completed impression is simply there, with a fade
 * under 150 ms and no press at all.
 *
 * This is one half of WP5's impression family. **View Atlas Stamp** on a
 * collected shop opens this sheet, and a reader who then goes to the Passport
 * and enlarges the same impression has to recognise it as the same object — so
 * the sheet is `ImpressionSheet` and the paper is `ImpressionPlate`, exactly as
 * in `PassportDetailOverlay`. Only the press animation, which belongs to the act
 * of collecting, is this component's own.
 */
export function StampCeremony({
  collection,
  alreadyCollected,
  passportHref,
  onClose,
}: StampCeremonyProps) {
  const dialogRef = useDialogFocus<HTMLDivElement>(true, onClose);
  const reviewer = useReviewerMode();
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
    <ImpressionSheet
      closeLabel="Close impression"
      dialogRef={dialogRef}
      labelledBy="stamp-ceremony-title"
      onClose={onClose}
      testId="stamp-ceremony"
      tier="Shop stamp"
    >
      <h2 className={styles.title} id="stamp-ceremony-title">
        {alreadyCollected ? "Already in your Passport" : "Impression collected"}
      </h2>
      {/*
        The ceremony has to stay honest without becoming a bulletin. Normal mode
        says the one thing a tester needs — the impression is a preview, their
        position was not checked — and says it once. The implementation detail
        behind that sentence belongs to reviewers.
      */}
      <p className={styles.lede}>
        {!collection.simulated ? "Your verified visit is kept in your private Passport." : reviewer
          ? "Simulated collection. This build does not use your location and issues no real stamp."
          : "A preview impression. Your location was not checked, so this is not a verified visit yet."}
      </p>

      {collection.stamp.commissioned ? <p>Illustrated by {collection.stamp.commissioned.illustratorCredit}</p> : null}

      <div
        className={styles.press}
        data-phase={phase}
        data-reduced={reduced ? "true" : "false"}
      >
        <span className={styles.contactShadow} aria-hidden="true" />
        <ImpressionPlate className={styles.plate} size="detail">
          <StampArt
            stamp={collection.stamp}
            title={collection.shopNameSnapshot}
            {...(collection.shopLocalNameSnapshot === undefined
              ? {}
              : {
                  localTitle: collection.shopLocalNameSnapshot,
                  localTitleLang: collection.shopLocalNameLangSnapshot,
                })}
            subtitle={collection.collectedOn}
          />
        </ImpressionPlate>
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
    </ImpressionSheet>
  );
}
