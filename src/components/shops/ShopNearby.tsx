import Link from "next/link";

import { distanceLabel, type NearbyShop } from "@/src/domain/nearby-shops";
import { SHOP_TYPE_LABELS } from "@/src/domain/shop-detail";

import styles from "./ShopDetailView.module.css";

/**
 * Nearby pen shops.
 *
 * Trip-planning context, not an itinerary: no ordering to follow, no route, no
 * schedule, no named trip. Just which other catalogue shops are in reach, so a
 * traveller can see a Ginza morning or a Kobe afternoon without the product
 * planning one for them.
 *
 * A distance appears only where both records were placed from a sourced street
 * address — see `nearbyPenShops`. Where it cannot be measured the entry says
 * where the shop is instead, which is the honest version of the same help.
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

  const anyMeasured = nearby.some((entry) => entry.distanceMeters !== null);

  return (
    <section className={`${styles.section} ${styles.wide}`} aria-labelledby="nearby">
      <h2 className={styles.sectionTitle} id="nearby">
        Nearby pen shops
      </h2>
      <ul className={styles.nearbyList}>
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
      {anyMeasured ? (
        <p className={styles.plain}>
          Distances are straight-line between approximate map points, not walking
          routes.
        </p>
      ) : null}
    </section>
  );
}
