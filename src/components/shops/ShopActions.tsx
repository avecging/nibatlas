"use client";

import Link from "next/link";
import { useCallback, useState, useSyncExternalStore } from "react";

import { useDialogFocus } from "@/src/components/hooks/useDialogFocus";
import {
  detectMapPlatform,
  directionsHref,
  type MapPlatform,
} from "@/src/components/shops/directions";
import { passportHrefWithAnchor } from "@/src/components/shops/ShopBackLink";
import { StampCeremony } from "@/src/components/stamps/StampCeremony";
import { Button, ButtonLink } from "@/src/components/ui/Button";
import { Icon } from "@/src/components/ui/Icon";
import { MarkerStateBadge } from "@/src/components/ui/StatusBadge";
import { countrySlug, type StampCollection } from "@/src/domain/passport";
import type { ShopDetail } from "@/src/domain/shop-detail";
import { markerStateFor } from "@/src/domain/user-state";
import { useCatalogue } from "@/src/features/catalogue/CatalogueProvider";
import { useCollection } from "@/src/features/collection/collection-store";
import { noopTelemetry } from "@/src/features/map/telemetry";
import { useReviewerMode } from "@/src/features/reviewer/ReviewerModeProvider";
import { prototypeLocalitySlugById } from "@/src/fixtures/prototype-catalogue";

import styles from "./ShopActions.module.css";

export function ShopStatusBadges({ shop }: { readonly shop: ShopDetail }) {
  const collection = useCollection();

  return <MarkerStateBadge state={markerStateFor(shop.id, collection.userShopState)} />;
}

/**
 * Directions open the platform's own maps application.
 *
 * WP4 replaces Milestone 1's OpenStreetMap marker link with a native handoff, per
 * `docs/milestone-1-5-product-refinement.md`: Apple Maps on Apple platforms, the
 * `geo:` intent on Android, and OpenStreetMap's directions page where there is no
 * application to hand to. Nib Atlas never embeds an itinerary.
 *
 * The platform never changes for a document, so this is a read of the
 * environment rather than state: the server snapshot is the universal fallback,
 * which works everywhere, and hydration upgrades it to the native handoff. That
 * is the same shape `useMediaQuery` uses, and it keeps the two renders in
 * agreement instead of correcting one after paint.
 */
const NO_SUBSCRIPTION = () => () => {};

function useMapPlatform(): MapPlatform {
  return useSyncExternalStore(
    NO_SUBSCRIPTION,
    () => detectMapPlatform(window.navigator.userAgent),
    () => "other" as const,
  );
}

export function ShopActions({ shop }: { readonly shop: ShopDetail }) {
  const catalogue = useCatalogue();
  const collection = useCollection();
  const reviewer = useReviewerMode();
  const platform = useMapPlatform();
  const [preflightOpen, setPreflightOpen] = useState(false);
  const [ceremony, setCeremony] = useState<StampCollection | null>(null);
  const [wasAlreadyCollected, setWasAlreadyCollected] = useState(false);

  const closePreflight = useCallback(() => setPreflightOpen(false), []);
  const preflightRef = useDialogFocus<HTMLDivElement>(preflightOpen, closePreflight);

  const existing = collection.collectionForShop(shop.id);
  /** Simulated collection is fixture/reviewer-only. See the button below. */
  const { simulatedCollection } = catalogue;

  /*
   * The ceremony opens the Passport at the impression that was just pressed, not
   * at whatever page the session happened to be on. `UX.md` requires a direct
   * transition from a new stamp into the relevant Passport section.
   *
   * The impression's own id goes with it, because a locality that already spans
   * several pages would otherwise open at its first page — which may not be the
   * page the new stamp landed on.
   */
  const localitySlug =
    prototypeLocalitySlugById.get(shop.id) ?? shop.localityName.toLowerCase();
  const localityHref = `/passport/${countrySlug(shop.countryCode)}/${localitySlug}`;

  /*
   * Viewing a collected impression and collecting a new one are two different
   * acts, so they take two different paths.
   *
   * A stamp already in the Passport has nothing to confirm: the label already
   * says *View Atlas Stamp*, so the preflight that followed it asked the reader
   * to agree to something they had already done, and its confirm button ran a
   * collection that the store then declined. One tap now opens the impression
   * the reader asked for. Nothing is issued, `collectedOn` is untouched, and
   * `StampCeremony` suppresses the press for an impression it did not just take.
   */
  function viewCollectedImpression(collected: StampCollection) {
    setWasAlreadyCollected(true);
    setCeremony(collected);
  }

  /*
   * Reached only when nothing was collected at the moment the preflight opened.
   *
   * The duplicate outcome survives for the one case that can still produce it:
   * another tab collecting this shop while the preflight is open. The store is
   * idempotent, so that resolves to the impression that already exists rather
   * than a second one, and the event says so.
   */
  function confirmCollection() {
    const alreadyCollected = existing !== undefined;
    const issued = collection.collectStamp(shop);

    setWasAlreadyCollected(alreadyCollected);
    setPreflightOpen(false);
    setCeremony(issued);
    noopTelemetry.record("stamp_collected", {
      shopSlug: shop.slug,
      outcome: alreadyCollected ? "duplicate" : "issued",
    });
  }

  return (
    <>
      {/*
        Save is not here: it is the bookmark beside the shop's name, so the two
        remaining controls are the ones a visitor acts on — get there, and press
        the stamp once there. There is no second *Official site* button either;
        the sourced website is a contextual link in *Before you go*, where the
        rest of the visit information lives.
      */}
      <div className={styles.actions}>
        <ButtonLink
          href={directionsHref(shop, platform)}
          variant="quiet"
          external
          onClick={() =>
            noopTelemetry.record("directions_opened", { shopSlug: shop.slug })
          }
        >
          <Icon name="directions" size={18} />
          Directions
        </ButtonLink>

        {/*
          Collect Stamp stays visible in both modes, per accepted decision 2. Only
          the label's diagnostic suffix is reviewer-only: a tester should read the
          product's action, not the build's caveat, on the button itself.

          Solid Plum before collection, the restrained Vermilion visited step
          after it: the invitation and its outcome are no longer the same colour.

          "Both modes" is reviewer and normal, not fixture and API. The flow
          issues a *simulated* impression from device-local state, and issue #25
          keeps it out of API mode entirely: beside real catalogue records a
          simulated stamp would read as a collection that had been verified.
          Real issuance is Milestone 5.
        */}
        {simulatedCollection ? (
          <Button
            variant={existing ? "collected" : "stamp"}
            onClick={() =>
              existing ? viewCollectedImpression(existing) : setPreflightOpen(true)
            }
          >
            <Icon name="seal" size={18} />
            {existing
              ? "View Atlas Stamp"
              : reviewer
                ? "Collect Stamp (simulated)"
                : "Collect Stamp"}
          </Button>
        ) : null}
      </div>

      {simulatedCollection ? null : (
        <p className={styles.pendingNote} data-testid="collection-pending">
          <span>
            <strong>Atlas Stamps are not being issued yet.</strong> Collecting one
            needs the location check that confirms you are standing in the shop,
            and that arrives in a later release.
          </span>
        </p>
      )}

      {existing && simulatedCollection ? (
        <p className={styles.collected}>
          <span>
            <strong>Collected {existing.collectedOn}</strong>
            {reviewer ? ` (${existing.shopTimezone}, simulated)` : ""}. This
            impression is in your Passport.
          </span>
        </p>
      ) : null}

      {preflightOpen ? (
        <div className={styles.backdrop}>
          <div
            ref={preflightRef}
            className={styles.dialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby="collect-preflight-title"
            tabIndex={-1}
          >
            <h2 className={styles.dialogTitle} id="collect-preflight-title">
              Before you collect
            </h2>
            <div className={styles.dialogBody}>
              {/*
                The location explanation is reduced to the minimum a person needs
                at the moment it would be requested: one sentence on the one-time
                foreground check, and one honest sentence that it is not running
                yet. The full plain-language account lives on Privacy, which is
                linked from here rather than reproduced.
              */}
              <p>
                Nib Atlas asks for your location once, here at the shop, to
                confirm you are there. It is checked and discarded, never stored
                and never read in the background.{" "}
                <Link className={styles.dialogLink} href="/privacy">
                  How location is used
                </Link>
                .
              </p>
              <p>
                <strong>That check is not running yet.</strong> Confirming keeps a
                preview impression on this device so you can see how the Passport
                works; it is not a verified visit.
              </p>
              {reviewer ? (
                <p className={styles.dialogDiagnostic}>
                  Reviewer note: this build never calls the Geolocation API. The
                  confirm action issues a simulated collection so the ceremony,
                  seal derivation, and Passport can be reviewed.
                </p>
              ) : null}
            </div>
            <div className={styles.dialogActions}>
              {/*
                Atlas Navy, not Plum.

                This confirms an intent; it is not the collectible entry point and
                not a successful verification. Plum is reserved for the action that
                offers a stamp — the header control — and turning the dialog's
                confirm button the same colour made the two read as the same step.
              */}
              <Button variant="primary" fullWidth onClick={confirmCollection}>
                {reviewer ? "Simulate: I am at this shop" : "I am at this shop"}
              </Button>
              <Button variant="quiet" fullWidth onClick={closePreflight}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {ceremony ? (
        <StampCeremony
          collection={ceremony}
          alreadyCollected={wasAlreadyCollected}
          passportHref={passportHrefWithAnchor(localityHref, ceremony.id)}
          onClose={() => setCeremony(null)}
        />
      ) : null}
    </>
  );
}
