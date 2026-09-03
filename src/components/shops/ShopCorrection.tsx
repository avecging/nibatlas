import Link from "next/link";

import { readCatalogueMode } from "@/src/features/catalogue/catalogue-mode";
import {
  shopCorrectionHref,
  shopCorrectionPath,
} from "@/src/features/contribute/contribute-links";

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
 * The in-app form is offered only where the intake can accept the slug. The
 * contribution intake resolves `shopSlug` against the prototype catalogue
 * (`app/api/contribute/route.ts`), so in API mode the form would 404 on a live
 * record; the control falls back to the mail route, which needs no catalogue
 * lookup, rather than becoming a broken link. Pointing intake at the read API is
 * a contract change and is left to Codex — recorded in the WP2 pull request.
 */
export function ShopCorrection({
  shopSlug,
  shopName,
}: {
  readonly shopSlug: string;
  readonly shopName: string;
}) {
  const inApp = readCatalogueMode().mode === "fixture";

  return (
    <p className={styles.correction}>
      Found something wrong with this listing? Let us know and we&rsquo;ll look
      into it as soon as possible.{" "}
      {inApp ? (
        <Link className={styles.inlineLink} href={shopCorrectionPath(shopSlug)}>
          Report incorrect information
        </Link>
      ) : (
        <a className={styles.inlineLink} href={shopCorrectionHref(shopName)}>
          Report incorrect information
        </a>
      )}
      .
    </p>
  );
}
