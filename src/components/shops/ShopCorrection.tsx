import { shopCorrectionHref } from "@/src/features/contribute/contribute-links";

import styles from "./ShopDetailView.module.css";

/**
 * Report incorrect information.
 *
 * Accepted decision 8, as amended on 27 August 2026: this control belongs on the
 * shop page rather than in Me, because a global control cannot name the shop the
 * reader is looking at — which is the part that makes the mail useful. The copy
 * is the approved natural product language, and the route is the
 * `[Shop correction]` mailto WP2 defined and deliberately left unwired.
 *
 * Quiet by design: it sits with the provenance line at the foot of the page, as
 * a way to correct the record rather than an invitation to publish. Nothing here
 * accepts content, so no community publishing surface is created.
 */
export function ShopCorrection({ shopName }: { readonly shopName: string }) {
  return (
    <p className={styles.correction}>
      Found something wrong with this listing? Let us know and we&rsquo;ll look
      into it as soon as possible.{" "}
      <a className={styles.inlineLink} href={shopCorrectionHref(shopName)}>
        Report incorrect information
      </a>
      .
    </p>
  );
}
