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
  readonly onSelect: (shopId: string) => void;
  readonly onToggleSaved: (shopId: string) => void;
  readonly onOpenDetail?: (shop: ShopMapSummary) => void;
}

export function ShopCard({
  shop,
  selected,
  specialtyLine,
  saved,
  onSelect,
  onToggleSaved,
  onOpenDetail,
}: ShopCardProps) {
  const headingId = `shop-card-${shop.id}`;

  return (
    <li>
      <article
        className={`${styles.card} ${selected ? styles.selected : ""}`}
        aria-labelledby={headingId}
        data-shop-id={shop.id}
        data-selected={selected ? "true" : "false"}
      >
        <div className={styles.thumb} aria-hidden="true">
          No image
          <br />
          (demo)
        </div>
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
              href={`/shops/${shop.slug}`}
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
