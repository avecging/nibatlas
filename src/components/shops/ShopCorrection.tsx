import Link from "next/link";

import { shopCorrectionPath } from "@/src/features/contribute/contribute-links";

import styles from "./ShopDetailView.module.css";

/**
 * Report incorrect information.
 *
 * Accepted decision 8, as amended on 27 August 2026: this control belongs on the
 * shop page rather than in Me, because a global control cannot name the shop the
 * reader is looking at — which is the part that makes the mail useful. The copy
 * is the approved natural product language, and WP7 points it at the real
 * correction form under this listing — which carries the shop, so the reader is
 * never asked which one they mean.
 *
 * Quiet by design: it sits with the provenance line at the foot of the page, as
 * a way to correct the record rather than an invitation to publish. Nothing here
 * accepts content, so no community publishing surface is created.
 *
 * The report page and intake resolve the slug through the same explicit
 * catalogue mode as the listing, so fixture and API records use the same
 * first-party correction flow. Email remains the form's delivery fallback.
 */
export function ShopCorrection({
  shopSlug,
}: {
  readonly shopSlug: string;
}) {
  return (
    <p className={styles.correction}>
      Found something wrong with this listing? Let us know and we&rsquo;ll look
      into it as soon as possible.{" "}
      <Link className={styles.inlineLink} href={shopCorrectionPath(shopSlug)}>
        Report incorrect information
      </Link>
      .
    </p>
  );
}
