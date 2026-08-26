"use client";

import { provenanceSentence } from "@/src/components/shops/provenance";
import { Icon } from "@/src/components/ui/Icon";
import { PrototypeBadge } from "@/src/components/ui/StatusBadge";
import {
  POSITION_PRECISION_LABELS,
  SOURCE_KIND_LABELS,
  type ShopDetail,
} from "@/src/domain/shop-detail";
import { useReviewerMode } from "@/src/features/reviewer/ReviewerModeProvider";

import styles from "./ShopDetailView.module.css";

/**
 * The two reviewer-facing parts of the shop page, as client islands.
 *
 * `ShopDetailView` stays a server component; only the material that has to
 * disappear for a normal tester is a client component, and it decides for
 * itself rather than receiving reviewer-only children from the server. That
 * keeps the source list, the retrieval dates and the coordinate precision out
 * of the HTML and the RSC payload a tester's browser receives.
 */

/**
 * Coordinate precision.
 *
 * Milestone 1 put an "approximate, not a surveyed coordinate" row on every shop
 * page. It is true, and it is a note to Milestone 7 about what still needs field
 * verification — not something a visitor deciding whether to travel can use.
 * Directions open the platform's own maps application either way.
 */
export function ShopPositionDiagnostic({ shop }: { readonly shop: ShopDetail }) {
  const reviewer = useReviewerMode();

  if (!reviewer) {
    return null;
  }

  return (
    <p className={styles.fact}>
      <Icon name="map" size={18} />
      <span>
        <span className={styles.factLabel}>Map position</span>
        {POSITION_PRECISION_LABELS[shop.positionPrecision]}. Not a surveyed
        coordinate.
      </span>
    </p>
  );
}

/**
 * Provenance.
 *
 * Normal mode gets the one subordinate sentence accepted decision 1 settles on:
 * where the details came from and when they were checked. Reviewer mode keeps
 * the full per-field list, because knowing which source confirms which field is
 * exactly what a sourcing review needs.
 */
export function ShopProvenance({ shop }: { readonly shop: ShopDetail }) {
  const reviewer = useReviewerMode();

  if (!reviewer) {
    const sentence = provenanceSentence(shop.sources);

    // A record with no source gets no line at all. A vague claim of provenance
    // would be worse than none.
    return sentence ? (
      <p className={`${styles.provenanceLine} ${styles.wide}`}>{sentence}</p>
    ) : null;
  }

  return (
    <section
      className={`${styles.provenance} ${styles.wide}`}
      aria-labelledby="provenance"
      data-testid="shop-provenance-detail"
    >
      <h2 className="type-h3" id="provenance">
        Where this came from
      </h2>
      <p>
        Nib Atlas shows only what a source supports. Anything a source did not
        confirm is left off this page rather than filled in.
      </p>
      <ul className={styles.sourceList}>
        {shop.sources.map((source) => (
          <li className={styles.sourceRow} key={`${source.label}-${source.retrievedOn}`}>
            <span className={styles.sourceKind}>{SOURCE_KIND_LABELS[source.kind]}</span>
            <p className={styles.sourceLabel}>
              {source.url ? (
                <a href={source.url} rel="noreferrer noopener" target="_blank">
                  {source.label}
                </a>
              ) : (
                source.label
              )}
            </p>
            <span className={styles.sourceMeta}>
              Read {source.retrievedOn} · confirms {source.confirms.join(", ")}
            </span>
          </li>
        ))}
      </ul>
      <div className={styles.provenanceFooter}>
        <PrototypeBadge>Prototype catalogue</PrototypeBadge>
        <span>
          A small sourced sample for review, not a complete or continuously
          verified catalogue. Contribution and correction routing arrives with
          WP7.
        </span>
      </div>
    </section>
  );
}
