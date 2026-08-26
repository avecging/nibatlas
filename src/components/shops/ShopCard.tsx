"use client";

import { Button, ButtonLink } from "@/src/components/ui/Button";
import { Icon } from "@/src/components/ui/Icon";
import {
  MarkerStateBadge,
  OperationalStatusBadge,
} from "@/src/components/ui/StatusBadge";
import { localeForCountry } from "@/src/components/shops/locale";
import { SHOP_TYPE_LABELS } from "@/src/domain/shop-detail";
import type { ShopMapSummary } from "@/src/domain/shops";

import styles from "./ShopCard.module.css";

interface ShopCardProps {
  readonly shop: ShopMapSummary;
  readonly selected: boolean;
  readonly specialtyLine: string | null;
  readonly saved: boolean;
  /** Surface the card sits on, so the shop page can offer the right way back. */
  readonly detailFrom?: "map" | "saved" | "passport";
  readonly onSelect: (shopId: string) => void;
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
 */
export function ShopCard({
  shop,
  selected,
  specialtyLine,
  saved,
  detailFrom = "map",
  onSelect,
  onToggleSaved,
  onOpenDetail,
}: ShopCardProps) {
  const headingId = `shop-card-${shop.id}`;
  const monogram = [...shop.name][0]?.toUpperCase() ?? "N";

  return (
    <li>
      <article
        className={`${styles.card} ${selected ? styles.selected : ""}`}
        aria-labelledby={headingId}
        data-shop-id={shop.id}
        data-selected={selected ? "true" : "false"}
      >
        <span className={styles.monogram} aria-hidden="true">
          {monogram}
        </span>
        <div className={styles.body}>
          <h3 className={styles.name} id={headingId}>
            <button
              type="button"
              className={styles.selectButton}
              aria-pressed={selected}
              onClick={() => onSelect(shop.id)}
            >
              {shop.name}
            </button>
          </h3>
          {shop.localName ? (
            <p className={styles.localName} lang={localeForCountry(shop.countryCode)}>
              {shop.localName}
            </p>
          ) : null}
          <p className={styles.meta}>
            {shop.localityName} · {SHOP_TYPE_LABELS[shop.primaryType]}
          </p>
          {specialtyLine ? <p className={styles.specialty}>{specialtyLine}</p> : null}
          <div className={styles.badges}>
            <MarkerStateBadge state={shop.markerState} />
            <OperationalStatusBadge status={shop.operationalStatus} />
          </div>
          <div className={styles.actions}>
            <ButtonLink
              href={`/shops/${shop.slug}?from=${detailFrom}`}
              variant="quiet"
              compact
              onClick={() => onOpenDetail?.(shop)}
            >
              Shop details
            </ButtonLink>
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
