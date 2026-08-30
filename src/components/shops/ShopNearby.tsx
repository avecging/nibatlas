import Link from "next/link";

import { distanceLabel, type NearbyShop } from "@/src/domain/nearby-shops";
import { SHOP_TYPE_LABELS } from "@/src/domain/shop-detail";

import styles from "./ShopDetailView.module.css";

/**
 * Nearby pen shops, inside *Getting there*.
 *
 * The founder's staging review of WP4 moved this out of its own full-width
 * section at the foot of the page: which other shops are within reach is part of
 * how you plan getting to this one, not a separate topic, and a standalone card
 * for one or two links read as a bigger feature than it is.
 *
 * Trip-planning context, not an itinerary: no ordering to follow, no route, no
 * schedule, no walking-time estimate.
 *
 * The straight-line disclaimer went with the move. `Approx.` already says the
 * figure is approximate, and a paragraph of methodology under two links was
 * heavier than the fact it qualified — the honesty that matters is in
 * `nearbyPenShops`, which offers no number at all unless both records were
 * placed from a sourced street address.
 */
export function ShopNearby({
  nearby,
  localityName,
}: {
  readonly nearby: readonly NearbyShop[];
  readonly localityName: string;
}) {
  if (nearby.length === 0) {
    return null;
  }

  return (
    <div className={styles.nearby}>
      <h4 className={styles.nearbyHeading} id="nearby">
        Nearby pen shops
      </h4>
      <ul className={styles.nearbyList} aria-labelledby="nearby">
        {nearby.map((entry) => (
          <li key={entry.shop.id}>
            <Link className={styles.nearbyRow} href={`/shops/${entry.shop.slug}`}>
              <span className={styles.nearbyName}>{entry.shop.name}</span>
              <span className={styles.nearbyMeta}>
                {entry.distanceMeters === null
                  ? `Also in ${entry.sameLocality ? localityName : entry.shop.localityName}`
                  : distanceLabel(entry.distanceMeters)}
                {" · "}
                {SHOP_TYPE_LABELS[entry.shop.primaryType]}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
