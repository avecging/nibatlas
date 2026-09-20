import type { ReactNode } from "react";

import { ShopLogoMark } from "@/src/components/shops/ShopLogoMark";
import { shopTypeLabel, type ShopDetail } from "@/src/domain/shop-detail";

import styles from "./ShopDetailView.module.css";

/**
 * Who this shop is: the mark, the name, the place, and one bookmark.
 *
 * This replaces the designed identity plate accepted decision 5 introduced. That
 * plate stood in for a photograph while no shop had one, carried the Nib Atlas
 * mark and the shop's own stamp motif, and was the right answer then. Published
 * photographs and business logos now exist, and the founder's shop UI direction
 * asks for the stamp taken out of discovery: the impression belongs to
 * collection and the Passport, not to the top of every listing. Nothing about
 * the stamp flow changes — `VerifiedCollection`, the ceremony, and the existing
 * impression view are untouched.
 *
 * What replaces it is an editorial header: locality, the shop's own logo where
 * it has published one, its name in both scripts, what kind of shop it is, and
 * the Save bookmark in a position that does not move with the length of a name.
 * A record with no logo is text-led, with no reserved square and no invented
 * mark.
 */
export function ShopIdentityHero({
  shop,
  save,
  badges,
  titleAs: Title = "h1",
}: {
  readonly shop: ShopDetail;
  /**
   * The Save bookmark, as a client island.
   *
   * It sits beside the name because that is what it applies to, and because the
   * founder's staging review found it competing with Collect Stamp when it was a
   * full button in the action row.
   */
  readonly save?: ReactNode;
  /** Saved/visited state and the operational status, as client islands. */
  readonly badges?: ReactNode;
  /**
   * The shop page's identity carries the page's `h1`. The styleguide renders the
   * same block as a specimen inside its own section, where an `h1` would be a
   * second document title, so it asks for a paragraph instead.
   */
  readonly titleAs?: "h1" | "p";
}) {
  return (
    <header className={styles.identity} data-testid="shop-identity">
      <p className={styles.identityPlace}>{shop.localityName}</p>

      {/*
        Three parts on one row, in a flex line rather than fixed columns: the
        mark takes the width its own proportions need, the name takes the rest,
        and the bookmark keeps its 44 px at the end of the line. A wide mark
        takes the row above the name on a phone — see `ShopMedia.module.css`.
      */}
      <div className={styles.identityRow}>
        <ShopLogoMark />
        <div className={styles.identityText}>
          <Title className={styles.title}>{shop.name}</Title>
          {shop.localName ? (
            <p className={styles.localTitle} lang={shop.localNameLang} dir="auto">
              {shop.localName}
            </p>
          ) : null}
          <p className={styles.identityTypes}>
            {shop.shopTypes
              .map((type) => shopTypeLabel(type, shop.shopTypeLabels?.[type]))
              .join(" · ")}
          </p>
        </div>
        {save ? <div className={styles.identityBookmark}>{save}</div> : null}
      </div>

      {badges ? <div className={styles.badges}>{badges}</div> : null}
    </header>
  );
}
