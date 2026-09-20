import type { ReactNode } from "react";

import { NibAtlasMark } from "@/src/components/brand/NibAtlasMark";
import { STAMP_MOTIF_PATHS } from "@/src/components/stamps/StampArt";
import { Icon } from "@/src/components/ui/Icon";
import { shopTypeLabel, type ShopDetail } from "@/src/domain/shop-detail";

import styles from "./ShopDetailView.module.css";

/**
 * The designed shop identity, standing in for a photograph.
 *
 * Accepted decision 5: development does not wait for image permissions, and the
 * answer is a deliberately designed interim treatment rather than an empty
 * gallery. So this is a plate in the Atlas paper palette carrying the Nib Atlas
 * mark, the shop's own name, and the same motif line art its Atlas Stamp is
 * drawn with — one identity across the map, the page and the impression, rather
 * than a grey rectangle where a picture should be.
 *
 * The motif is a watermark at low contrast, not an illustration of the shop: the
 * record does not claim to know what the shopfront looks like, and the page must
 * not imply it. "Photos coming soon" is one caption, once, and there are no
 * repeated empty slots and no photo-count badge — a count would be a claim about
 * images that do not exist.
 */
export function ShopIdentityHero({
  shop,
  save,
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
  /**
   * The shop page's identity plate carries the page's `h1`. The styleguide
   * renders the same plate as a specimen inside its own section, where an `h1`
   * would be a second document title, so it asks for a paragraph instead.
   */
  readonly titleAs?: "h1" | "p";
}) {
  return (
    <div className={styles.hero} data-ink={shop.stamp.ink}>
      <svg className={styles.heroMotif} viewBox="0 0 120 120" aria-hidden="true" focusable="false">
        <g
          fill="none"
          stroke="currentColor"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {STAMP_MOTIF_PATHS[shop.stamp.motif].map((d) => (
            <path key={d} d={d} />
          ))}
        </g>
      </svg>

      <p className={styles.heroBrand}>
        <NibAtlasMark size={22} tone="duotone" />
        <span>Nib Atlas</span>
      </p>

      <div className={styles.heroIdentity}>
        {/*
          The bookmark leads the row, in its own fixed column.
          `銀座 伊東屋 横浜元町` wrapped onto two lines and pushed the control
          below the name when the name came first; a control that moves with the
          length of a shop's name is not a control anyone can find twice.
        */}
        <div className={styles.heroNameRow} data-save={save ? "true" : "false"}>
          {save}
          <Title className={styles.title}>{shop.name}</Title>
        </div>
        <p className={styles.heroPlace}>
          {shop.localityName} ·{" "}
          {shop.shopTypes.map((type) => shopTypeLabel(type,shop.shopTypeLabels?.[type])).join(" · ")}
        </p>
      </div>

      {process.env.NEXT_PUBLIC_CATALOGUE_MODE !== "api" && process.env.NEXT_PUBLIC_CATALOGUE_MODE !== "api-demo" && <p className={styles.heroPhotos}>
        <Icon name="camera" size={16} />
        <span>Photos coming soon</span>
      </p>}
    </div>
  );
}

/** The shop's own name, in its own script, directly under the identity plate. */
export function ShopLocalName({ shop }: { readonly shop: ShopDetail }) {
  if (!shop.localName) {
    return null;
  }

  return (
    <p className={styles.localTitle} lang={shop.localNameLang} dir="auto">
      {shop.localName}
    </p>
  );
}
