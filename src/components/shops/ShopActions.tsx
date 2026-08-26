"use client";

import { useCallback, useState } from "react";

import { useDialogFocus } from "@/src/components/hooks/useDialogFocus";
import { StampCeremony } from "@/src/components/stamps/StampCeremony";
import { Button, ButtonLink } from "@/src/components/ui/Button";
import { Icon } from "@/src/components/ui/Icon";
import { MarkerStateBadge } from "@/src/components/ui/StatusBadge";
import type { StampCollection } from "@/src/domain/passport";
import type { ShopDetail } from "@/src/domain/shop-detail";
import { markerStateFor } from "@/src/domain/user-state";
import { useCollection } from "@/src/features/collection/collection-store";
import { noopTelemetry } from "@/src/features/map/telemetry";

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
  const [preflightOpen, setPreflightOpen] = useState(false);
  const [ceremony, setCeremony] = useState<StampCollection | null>(null);
  const [wasAlreadyCollected, setWasAlreadyCollected] = useState(false);

  const closePreflight = useCallback(() => setPreflightOpen(false), []);
  const preflightRef = useDialogFocus<HTMLDivElement>(preflightOpen, closePreflight);

  const saved = collection.isSaved(shop.id);
  const existing = collection.collectionForShop(shop.id);
  const officialLink = (shop.links ?? []).find((link) => link.isOfficial);

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

        <Button variant="stamp" onClick={() => setPreflightOpen(true)}>
          <Icon name="seal" size={18} />
          {existing ? "View Atlas Stamp" : "Collect Stamp (simulated)"}
        </Button>
      </div>

      {existing ? (
        <p className={styles.collected}>
          <span>
            <strong>Collected {existing.collectedOn}</strong> ({existing.shopTimezone},
            simulated). This impression is in your Passport.
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
              <p>
                In the finished product, Nib Atlas asks for your location once, at the
                shop, to confirm you are there. The position is checked and discarded;
                it is never stored, and it is never read in the background.
              </p>
              <p>
                This prototype does not request your location and issues no real stamp.
                Confirming simulates the outcome so the ceremony and Passport can be
                reviewed.
              </p>
            </div>
            <div className={styles.dialogActions}>
              <Button variant="stamp" fullWidth onClick={confirmCollection}>
                {existing ? "Show the impression" : "Simulate: I am at this shop"}
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
          passportHref="/passport"
          onClose={() => setCeremony(null)}
        />
      ) : null}
    </>
  );
}
