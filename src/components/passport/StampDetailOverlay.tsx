"use client";

import { useCallback, useId } from "react";

import { useDialogFocus } from "@/src/components/hooks/useDialogFocus";
import { localeForCountry } from "@/src/components/shops/locale";
import { StampArt } from "@/src/components/stamps/StampArt";
import { ButtonLink } from "@/src/components/ui/Button";
import { Icon } from "@/src/components/ui/Icon";
import type { StampCollection } from "@/src/domain/passport";

import styles from "./StampDetailOverlay.module.css";

const TIER_LABEL = {
  shop: "Shop stamp",
  locality: "Locality seal",
  country: "Country seal",
} as const;

export interface StampDetailOverlayProps {
  readonly collection: StampCollection | null;
  readonly onClose: () => void;
  /**
   * The Passport route the reader is on.
   *
   * Carried to the shop page so its one back control returns *here* — the
   * locality route, not the overview — and the Passport then reopens in the mode
   * and at the spread the reader left. Browser Back does the same thing on its
   * own; this is for the control.
   */
  readonly returnHref?: string | undefined;
}

/**
 * One impression, at a size worth looking at.
 *
 * Milestone 1 had no way to enlarge a stamp: the artwork existed only at
 * thumbnail size on a book page, which is where the founder's review found it.
 * The overlay is the same in List and Book mode, so a stamp behaves identically
 * wherever it is tapped.
 *
 * It shows what the impression itself records and nothing more. There is no
 * rating, no note, no sharing and no visit history — a stamp is a keepsake, not
 * a review.
 */
export function StampDetailOverlay({
  collection,
  onClose,
  returnHref = "/passport",
}: StampDetailOverlayProps) {
  const headingId = useId();
  const close = useCallback(() => onClose(), [onClose]);
  const dialogRef = useDialogFocus<HTMLDivElement>(collection !== null, close);

  if (!collection) {
    return null;
  }

  return (
    <div className={styles.scrim} data-testid="stamp-detail">
      {/*
        A click on the scrim closes, like every other dismissible surface in the
        product. It is not the only way out: the close control and Escape both
        work, and the scrim itself is never the accessible route.
      */}
      <button
        className={styles.scrimButton}
        type="button"
        tabIndex={-1}
        aria-hidden="true"
        onClick={close}
      />
      <div
        className={styles.dialog}
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        tabIndex={-1}
      >
        <button
          className={styles.close}
          type="button"
          onClick={close}
          aria-label="Close stamp"
        >
          <Icon name="close" size={18} />
        </button>

        <div className={styles.impression} data-no-drag="true">
          <StampArt
            stamp={collection.stamp}
            title={collection.shopNameSnapshot}
            localTitle={collection.shopLocalNameSnapshot}
            subtitle={collection.collectedOn}
          />
        </div>

        <p className={styles.tier}>{TIER_LABEL[collection.stamp.tier]}</p>

        <h2 className={styles.name} id={headingId}>
          {collection.shopNameSnapshot}
        </h2>
        {collection.shopLocalNameSnapshot ? (
          <p
            className={styles.localName}
            lang={localeForCountry(collection.countryCode)}
          >
            {collection.shopLocalNameSnapshot}
          </p>
        ) : null}

        <dl className={styles.facts}>
          <div>
            <dt>Locality</dt>
            <dd>{collection.localityName}</dd>
          </div>
          <div>
            <dt>Country</dt>
            <dd>{collection.countryLabel}</dd>
          </div>
          <div>
            <dt>Collected</dt>
            <dd>
              <time dateTime={collection.collectedOn}>{collection.collectedOn}</time>
            </dd>
          </div>
        </dl>

        <ButtonLink
          href={`/shops/${collection.shopSlug}?from=passport&back=${encodeURIComponent(returnHref)}`}
          variant="primary"
          fullWidth
        >
          Open shop
        </ButtonLink>
      </div>
    </div>
  );
}
