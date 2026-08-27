"use client";

import Link from "next/link";
import { useCallback, useState } from "react";

import { useDialogFocus } from "@/src/components/hooks/useDialogFocus";
import { passportHrefWithAnchor } from "@/src/components/shops/ShopBackLink";
import { StampCeremony } from "@/src/components/stamps/StampCeremony";
import { Button, ButtonLink } from "@/src/components/ui/Button";
import { Icon } from "@/src/components/ui/Icon";
import { MarkerStateBadge } from "@/src/components/ui/StatusBadge";
import { countrySlug, type StampCollection } from "@/src/domain/passport";
import type { ShopDetail } from "@/src/domain/shop-detail";
import { markerStateFor } from "@/src/domain/user-state";
import { useCollection } from "@/src/features/collection/collection-store";
import { noopTelemetry } from "@/src/features/map/telemetry";
import { useReviewerMode } from "@/src/features/reviewer/ReviewerModeProvider";
import { prototypeLocalitySlugById } from "@/src/fixtures/prototype-catalogue";

import styles from "./ShopActions.module.css";

export function ShopStatusBadges({ shop }: { readonly shop: ShopDetail }) {
  const collection = useCollection();

  return <MarkerStateBadge state={markerStateFor(shop.id, collection.userShopState)} />;
}

function externalMapUrl(shop: ShopDetail): string {
  const { latitude, longitude } = shop.position;

  return `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=17/${latitude}/${longitude}`;
}

export function ShopActions({ shop }: { readonly shop: ShopDetail }) {
  const collection = useCollection();
  const reviewer = useReviewerMode();
  const [preflightOpen, setPreflightOpen] = useState(false);
  const [ceremony, setCeremony] = useState<StampCollection | null>(null);
  const [wasAlreadyCollected, setWasAlreadyCollected] = useState(false);

  const closePreflight = useCallback(() => setPreflightOpen(false), []);
  const preflightRef = useDialogFocus<HTMLDivElement>(preflightOpen, closePreflight);

  const saved = collection.isSaved(shop.id);
  const existing = collection.collectionForShop(shop.id);
  const officialLink = (shop.links ?? []).find((link) => link.isOfficial);

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
      <div className={styles.actions}>
        <Button
          variant={saved ? "secondary" : "primary"}
          aria-pressed={saved}
          onClick={() => {
            const next = collection.toggleSaved(shop.id);
            noopTelemetry.record("shop_saved", {
              shopSlug: shop.slug,
              outcome: next ? "saved" : "unsaved",
            });
          }}
        >
          <Icon name={saved ? "bookmark-filled" : "bookmark"} size={18} />
          {saved ? "Saved" : "Save"}
        </Button>

        {officialLink ? (
          <ButtonLink href={officialLink.url} variant="quiet" external>
            <Icon name="link" size={18} />
            Official site
          </ButtonLink>
        ) : null}

        <ButtonLink
          href={externalMapUrl(shop)}
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
        */}
        <Button variant="stamp" onClick={() => setPreflightOpen(true)}>
          <Icon name="seal" size={18} />
          {existing
            ? "View Atlas Stamp"
            : reviewer
              ? "Collect Stamp (simulated)"
              : "Collect Stamp"}
        </Button>
      </div>

      {existing ? (
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
              {existing ? "You already have this stamp" : "Before you collect"}
            </h2>
            <div className={styles.dialogBody}>
              {/*
                The location explanation is reduced to the minimum a person needs
                at the moment it would be requested: one sentence on the one-time
                foreground check, and one honest sentence that it is not running
                yet. The full plain-language account lives on Privacy, which is
                linked from here rather than reproduced.
              */}
              {existing ? null : (
                <>
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
                    <strong>That check is not running yet.</strong> Confirming keeps
                    a preview impression on this device so you can see how the
                    Passport works; it is not a verified visit.
                  </p>
                </>
              )}
              {existing ? (
                <p>
                  You collected this impression on {existing.collectedOn}. Opening it
                  again does not issue a second stamp.
                </p>
              ) : null}
              {reviewer ? (
                <p className={styles.dialogDiagnostic}>
                  Reviewer note: this build never calls the Geolocation API. The
                  confirm action issues a simulated collection so the ceremony,
                  seal derivation, and Passport can be reviewed.
                </p>
              ) : null}
            </div>
            <div className={styles.dialogActions}>
              <Button variant="stamp" fullWidth onClick={confirmCollection}>
                {existing
                  ? "Show the impression"
                  : reviewer
                    ? "Simulate: I am at this shop"
                    : "I am at this shop"}
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
