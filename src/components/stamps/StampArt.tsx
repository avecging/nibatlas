import type { ShopStampDesign, StampMotif } from "@/src/domain/shop-detail";

import styles from "./StampArt.module.css";

const MOTIFS: Record<StampMotif, readonly string[]> = {
  "harbour-city": [
    "M4 30h40",
    "M9 30V17l7-5 7 5v13",
    "M27 30V21l6-4 6 4v9",
    "M4 34c4-2.2 7-2.2 11 0s7 2.2 11 0 7-2.2 11 0",
  ],
  shophouse: [
    "M5 31h38",
    "M8 31V13h32v18",
    "M8 19h32",
    "M14 31v-7h6v7",
    "M28 31v-7h6v7",
    "M14 14v-3M24 14v-3M34 14v-3",
  ],
  "torii-street": [
    "M6 14h36",
    "M9 18h30",
    "M14 18v16M34 18v16",
    "M6 34h36",
    "M22 26h4v8h-4z",
  ],
  "castle-town": [
    "M8 34h32",
    "M12 34V22l12-9 12 9v12",
    "M12 26h24",
    "M20 34v-6h8v6",
    "M24 13V8",
  ],
  "mountain-pass": [
    "M4 33 17 14l9 12 5-6 9 13z",
    "M4 33h38",
    "M14 21l3-4 3 4",
  ],
  "temple-lane": [
    "M7 33h34",
    "M11 33V19h22v14",
    "M9 19l13-8 13 8",
    "M19 33v-8h6v8",
  ],
  "island-coast": [
    "M4 32c5-3 9-3 14 0s9 3 14 0 8-2.5 12 0",
    "M14 22c0-5 4-9 9-9s9 4 9 9",
    "M23 22v6",
    "M31 15l4-4",
  ],
  "market-arcade": [
    "M6 32h36",
    "M9 32V16h30v16",
    "M9 16l6-6h18l6 6",
    "M17 32v-9h6v9",
    "M29 23h6v5h-6z",
  ],
};

interface StampArtProps {
  readonly stamp: ShopStampDesign;
  readonly shopName: string;
  readonly collectedOn?: string;
  readonly size?: "default" | "small";
}

export function StampArt({ stamp, shopName, collectedOn, size = "default" }: StampArtProps) {
  const inkClass =
    stamp.ink === "indigo"
      ? styles.inkIndigo
      : stamp.ink === "teal"
        ? styles.inkTeal
        : styles.inkVermilion;

  return (
    <figure
      className={`${styles.stamp} ${inkClass} ${size === "small" ? styles.small : ""}`}
      data-motif={stamp.motif}
      data-ink={stamp.ink}
    >
      <figcaption className={styles.country}>{stamp.countryLabel}</figcaption>
      <div className={styles.motif}>
        <svg
          width={size === "small" ? 44 : 56}
          height={size === "small" ? 36 : 44}
          viewBox="0 0 48 40"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          focusable="false"
        >
          {MOTIFS[stamp.motif].map((d) => (
            <path key={d} d={d} />
          ))}
        </svg>
        <p className={styles.name}>{shopName}</p>
        <p className={styles.locality}>{stamp.localityLabel}</p>
      </div>
      <div className={styles.footer}>
        <span>Nib Atlas</span>
        <span>{collectedOn ?? "Not collected"}</span>
      </div>
    </figure>
  );
}
