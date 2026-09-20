"use client";

import Link from "next/link";

import { Button } from "@/src/components/ui/Button";
import { Icon } from "@/src/components/ui/Icon";
import {
  OperationalStatusBadge,
  VisitedBadge,
} from "@/src/components/ui/StatusBadge";
import { shopTypeLabel } from "@/src/domain/shop-detail";
import type { ShopMapSummary } from "@/src/domain/shops";

import styles from "./ShopCard.module.css";

interface ShopCardProps {
  readonly shop: ShopMapSummary;
  readonly selected: boolean;
  /** Transient map/list synchronisation from hover or keyboard focus. */
  readonly highlighted: boolean;
  readonly specialtyLine: string | null;
  readonly saved: boolean;
  readonly visited: boolean;
  /** Hover highlighting is offered only where a real pointer can hover. */
  readonly hoverHighlights: boolean;
  /** Surface the card sits on, so the shop page can offer the right way back. */
  readonly detailFrom?: "map" | "saved" | "passport";
  readonly onHighlight: (shopId: string | null) => void;
  readonly onToggleSaved: (shopId: string) => void;
  readonly onOpenDetail?: (shop: ShopMapSummary) => void;
}

/**
 * No photograph appears on a card.
 *
 * `BRAND.md` allows one restrained image only where rights are known, and no
 * image in the prototype catalogue is rights-cleared. A serif monogram stands in
 * for it — quiet, and honest about the fact that there is no photo rather than
 * showing an empty frame that reads as a failure to load.
 *
 * The body of the card is one link to the shop. Milestone 1 made it a selection
 * toggle with a separate `Shop details` button, which meant a tap on a card did
 * nothing a reader could see on a phone, where the map behind the sheet is
 * mostly covered. Activating a card now opens the shop; the map keeps its own
 * way of selecting, through its markers.
 */
export function ShopCard({
  shop,
  selected,
  highlighted,
  specialtyLine,
  saved,
  visited,
  hoverHighlights,
  detailFrom = "map",
  onHighlight,
  onToggleSaved,
  onOpenDetail,
}: ShopCardProps) {
  const headingId = `shop-card-${shop.id}`;
  const monogram = [...shop.name][0]?.toUpperCase() ?? "N";

  const pointerProps = hoverHighlights
    ? {
        onMouseEnter: () => onHighlight(shop.id),
        onMouseLeave: () => onHighlight(null),
      }
    : {};

  return (
    <li>
      <article
        className={styles.card}
        aria-labelledby={headingId}
        data-shop-id={shop.id}
        data-selected={selected ? "true" : "false"}
        data-highlighted={highlighted ? "true" : "false"}
        // Keyboard focus gives the same map synchronisation a hover does, so a
        // reader who never touches a pointer is not left without it.
        onFocus={() => onHighlight(shop.id)}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
            onHighlight(null);
          }
        }}
        {...pointerProps}
      >
        <span className={styles.monogram} aria-hidden="true">
          {monogram}
        </span>
        <div className={styles.body}>
          <h3 className={styles.name} id={headingId}>
            <Link
              className={styles.openLink}
              href={`/shops/${shop.slug}?from=${detailFrom}`}
              onClick={() => onOpenDetail?.(shop)}
            >
              {shop.name}
            </Link>
          </h3>
          {shop.localName ? (
            <p className={styles.localName} lang={shop.localNameLang} dir="auto">
              {shop.localName}
            </p>
          ) : null}
          <p className={styles.meta}>
            {shop.localityName} · {shopTypeLabel(shop.primaryType,shop.primaryTypeLabel)}
          </p>
          {specialtyLine ? <p className={styles.specialty}>{specialtyLine}</p> : null}
          <div className={styles.badges}>
            {/*
              Two independent facts, not one three-position pill: how the shop is
              operating, and whether the reader has been. Saved is the third, and
              it is carried by its own control below rather than repeated here.
            */}
            <OperationalStatusBadge status={shop.operationalStatus} />
            <VisitedBadge visited={visited} />
          </div>
          <div className={styles.actions}>
            {/*
              An explicit control does its own job. Save must never open the
              shop, so it sits above the card-wide link rather than inside it.
            */}
            <Button
              variant={saved ? "secondary" : "quiet"}
              compact
              aria-pressed={saved}
              onClick={() => onToggleSaved(shop.id)}
            >
              <Icon name={saved ? "bookmark-filled" : "bookmark"} size={16} />
              {saved ? "Saved" : "Save"}
            </Button>
          </div>
        </div>
      </article>
    </li>
  );
}
