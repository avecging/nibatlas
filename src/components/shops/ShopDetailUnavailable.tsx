import Link from "next/link";

import { Icon } from "@/src/components/ui/Icon";
import { ShopUnavailableDiagnostic } from "@/src/components/shops/ShopReviewerDetails";
import type { ShopDetailUnavailableReason } from "@/src/features/shops/shop-detail-source";

import styles from "./ShopDetailView.module.css";

/**
 * The shop page when the catalogue could not answer for a slug.
 *
 * This is not a 404 and must never become one. A 404 tells the reader the shop
 * does not exist; a failed read says nothing about whether it does. The URL
 * therefore stays valid, and no catalogue fact is stated — not the name, not the
 * locality, nothing the record would have carried. The reader is offered the map,
 * which does not depend on this read.
 */
export function ShopDetailUnavailable({
  slug,
  reason,
}: {
  readonly slug: string;
  readonly reason: ShopDetailUnavailableReason;
}) {
  return (
    <main className={styles.page} data-testid="shop-detail-unavailable">
      <Link className={styles.back} href="/">
        <Icon name="chevron-left" size={16} />
        Back to map
      </Link>
      <header className={styles.header}>
        <h1 className={styles.title}>This shop page is unavailable</h1>
      </header>
      <p className={styles.lede}>
        We could not load this listing, so nothing about the shop is shown here
        rather than something we cannot stand behind. The link still works — try
        it again shortly.
      </p>
      <ShopUnavailableDiagnostic slug={slug} reason={reason} />
    </main>
  );
}
