import type { ShopStampDesign, StampMotif } from "@/src/domain/shop-detail";
import { STAMP_INK_LABELS } from "@/src/domain/stamp-palette";

import styles from "./StampArt.module.css";

/**
 * Motif line art.
 *
 * Drawn from stationery culture and generic street architecture. Nothing here is
 * a national symbol: `BRAND.md` forbids applying one country's iconography to
 * another, so a motif describes the shop, not the country it happens to be in.
 */
export const STAMP_MOTIF_PATHS: Record<StampMotif, readonly string[]> = {
  storefront: [
    "M18 104h84",
    "M26 104V58h68v46",
    "M20 58l40-24 40 24",
    "M44 104V80h16v24",
    "M74 74h18v16H74z",
  ],
  shophouse: [
    "M16 104h88",
    "M24 104V50h72v54",
    "M20 50h80",
    "M38 104V82h14v22",
    "M68 78h18v18H68z",
    "M38 46v-8M60 46v-8M82 46v-8",
  ],
  "ink-bottle": [
    "M34 104V64a26 26 0 0 1 52 0v40z",
    "M50 34h20v14H50z",
    "M42 84h36",
    "M60 48v16",
  ],
  nib: [
    "M60 30c26 28 34 58 0 84-34-26-26-56 0-84z",
    "M60 68v46",
    "M60 62a7 7 0 1 0 0 14 7 7 0 0 0 0-14z",
  ],
  arcade: [
    "M14 104h92",
    "M22 104V56h76v48",
    "M22 56l14-16h48l14 16",
    "M40 104V78h16v26",
    "M70 76h16v18H70z",
  ],
  harbour: [
    "M12 100c9-6 18-6 27 0s18 6 27 0 16-5 26 0",
    "M28 86V48l16-10 16 10v38",
    "M70 86V62l14-8 14 8v24",
    "M12 86h96",
  ],
  counter: [
    "M16 76h88v10H16z",
    "M24 86v18M96 86v18",
    "M32 76V52h24v24",
    "M66 76V44",
    "M58 44h16",
  ],
  workbench: [
    "M14 72h92",
    "M22 72v30M98 72v30",
    "M34 72V50h18v22",
    "M62 62h32",
    "M74 62V44h8v18",
  ],
};

const TIER_LABEL = {
  shop: "Shop",
  locality: "Locality",
  country: "Country",
} as const;

interface StampArtProps {
  readonly stamp: ShopStampDesign;
  /** Primary line inside the impression: shop name, locality, or country. */
  readonly title: string;
  readonly localTitle?: string | undefined;
  /** Local collection date, or nothing when the stamp has not been pressed. */
  readonly subtitle?: string | undefined;
  readonly size?: "default" | "small";
}

/**
 * One impression, one ink.
 *
 * The ink is already chosen and pinned on the design; this component never
 * decides it and never mixes two. Dual-ink and spectrum impressions are a future
 * edition and have no code path here.
 *
 * Frame anatomy carries tier — rounded for a shop, cornered for a locality,
 * double-ruled for a country — because `BRAND.md` requires tier to be legible
 * without colour doing the work.
 */
export function StampArt({
  stamp,
  title,
  localTitle,
  subtitle,
  size = "default",
}: StampArtProps) {
  const ink = `var(--ink-${stamp.ink})`;
  const filterId = `stamp-edge-${stamp.id}`;
  const grainId = `stamp-grain-${stamp.id}`;
  const nameLength = title.length;
  const nameSize = nameLength > 26 ? 26 : nameLength > 18 ? 31 : 37;

  const description = [
    `${TIER_LABEL[stamp.tier]} stamp`,
    title,
    stamp.tier === "shop" ? stamp.localityLabel : null,
    subtitle ? `collected ${subtitle}` : "not yet collected",
    `${STAMP_INK_LABELS[stamp.ink]} ink`,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <figure className={`${styles.stamp} ${size === "small" ? styles.small : ""}`} data-ink={stamp.ink}>
      <svg
        viewBox="0 0 600 400"
        className={styles.canvas}
        role="img"
        aria-label={description}
      >
        <defs>
          {/*
            Irregular edges and a light pressure mottle: BRAND.md asks for
            "slightly imperfect edges, mild registration shift, and pressure
            variation". `seed` is derived from the design id so an impression is
            reproducible rather than different on every render.
          */}
          <filter id={filterId} x="-8%" y="-8%" width="116%" height="116%">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.045"
              numOctaves="3"
              seed={stamp.id.length * 7}
              result="noise"
            />
            <feDisplacementMap
              in="SourceGraphic"
              in2="noise"
              scale="6"
              xChannelSelector="R"
              yChannelSelector="G"
            />
          </filter>
          <filter id={grainId} x="-8%" y="-8%" width="116%" height="116%">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.85"
              numOctaves="2"
              seed={stamp.id.length * 3}
              result="grain"
            />
            <feColorMatrix
              in="grain"
              type="matrix"
              values="0 0 0 0 0,0 0 0 0 0,0 0 0 0 0,0 0 0 -1.25 1.12"
              result="mask"
            />
            <feComposite in="SourceGraphic" in2="mask" operator="in" />
          </filter>
        </defs>

        <g filter={`url(#${filterId})`} opacity="0.97">
          <g filter={`url(#${grainId})`} fill="none" stroke={ink}>
            {stamp.tier === "shop" ? (
              <rect x="16" y="16" width="568" height="368" rx="34" strokeWidth="7" />
            ) : null}
            {stamp.tier === "locality" ? (
              <>
                <rect x="16" y="16" width="568" height="368" strokeWidth="7" />
                <path
                  d="M46 46h30M46 46v30M554 46h-30M554 46v30M46 354h30M46 354v-30M554 354h-30M554 354v-30"
                  strokeWidth="4.5"
                />
              </>
            ) : null}
            {stamp.tier === "country" ? (
              <>
                <rect x="14" y="14" width="572" height="372" strokeWidth="8" />
                <rect x="30" y="30" width="540" height="340" strokeWidth="2.6" />
              </>
            ) : null}

            <text
              x="42"
              y="76"
              className={styles.tier}
              fill={ink}
              stroke="none"
              opacity="0.8"
            >
              {TIER_LABEL[stamp.tier].toUpperCase()}
            </text>
            <text
              x="42"
              y="152"
              className={styles.name}
              fontSize={nameSize}
              fill={ink}
              stroke="none"
            >
              {title}
            </text>
            {localTitle ? (
              <text x="42" y="196" className={styles.local} fill={ink} stroke="none">
                {localTitle}
              </text>
            ) : null}
            <text
              x="42"
              y="258"
              className={styles.parent}
              fill={ink}
              stroke="none"
              opacity="0.85"
            >
              {(stamp.tier === "country"
                ? "NIB ATLAS"
                : `${stamp.localityLabel} · ${stamp.countryLabel}`
              ).toUpperCase()}
            </text>

            <g strokeWidth="8" transform="translate(400 132)">
              {STAMP_MOTIF_PATHS[stamp.motif].map((d) => (
                <path key={d} d={d} strokeLinecap="round" strokeLinejoin="round" />
              ))}
            </g>

            {subtitle ? (
              <text x="42" y="352" className={styles.date} fill={ink} stroke="none">
                {subtitle}
              </text>
            ) : null}
            <text
              x="558"
              y="352"
              textAnchor="end"
              className={styles.provenance}
              fill={ink}
              stroke="none"
              opacity="0.85"
            >
              NIB ATLAS
            </text>
          </g>
        </g>
      </svg>
    </figure>
  );
}
