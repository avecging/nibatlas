import type { ShopStampDesign, StampMotif } from "@/src/domain/shop-detail";
import { fitStampTitle } from "@/src/components/stamps/stamp-title";
import { languageDirection } from "@/src/domain/language";
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

/**
 * The device a country seal carries, in place of a motif.
 *
 * A country seal is not a portrait of a place: it is derived from verified
 * visits and issued by Nib Atlas, so a street motif borrowed from one of its
 * shops would say something the seal does not know. It carries the mark's own
 * geometry instead — the circle `BRAND.md` says reads equally as globe, seal and
 * stamp boundary, a restrained meridian grid, and the nib breather at the centre
 * that joins the mark's two halves.
 *
 * Drawn as strokes at the motifs' weight rather than as the full duotone
 * artwork: `BRAND.md` asks for simplified geometry at small sizes rather than
 * visual mud, and a one-colour imprint is exactly that context.
 */
export const SEAL_DEVICE_PATHS: readonly string[] = [
  "M60 16a44 44 0 1 1 0 88 44 44 0 0 1 0-88z",
  "M60 16c13 12 20 27 20 44s-7 32-20 44",
  "M60 16c-13 12-20 27-20 44s7 32 20 44",
  "M22 46h76",
  "M22 74h76",
  "M60 16v88",
  "M60 52a8 8 0 1 0 0 16 8 8 0 0 0 0-16z",
];

const TIER_LABEL = {
  shop: "Shop",
  locality: "Locality",
  country: "Country",
} as const;

/**
 * How much of the impression is drawn.
 *
 * `full` is every line the artefact records. `compact` is the same artefact at
 * the size a List row or a book page gives it — roughly 4.75 rem, where the
 * 600-unit canvas scales by about an eighth and the date, the provenance and the
 * place line become mottle rather than type. Those lines are dropped and the
 * ones that remain are set large enough to read, which is what
 * "small impressions must remain legible" asks for; every surface that uses
 * `compact` states the date and the place in real text beside the impression.
 */
export type StampArtDetail = "full" | "compact";

interface StampArtProps {
  readonly stamp: ShopStampDesign;
  /** Primary line inside the impression: shop name, locality, or country. */
  readonly title: string;
  readonly localTitle?: string | undefined;
  readonly localTitleLang?: string | undefined;
  /** Local collection date, or nothing when the stamp has not been pressed. */
  readonly subtitle?: string | undefined;
  readonly detail?: StampArtDetail;
}

/** Every impression is drawn in this box, whatever it is rendered at. */
const CANVAS = { width: 600, height: 400 } as const;
const MIDDLE = CANVAS.width / 2;

/**
 * The one foot rhythm: date at the left, Nib Atlas provenance at the right.
 *
 * A locality seal's cornered frame reaches into that line, so its foot is set
 * one step in and one step up — the same rhythm, clear of its own frame.
 */
const FOOT_BASELINE = 352;
const SEAL_FOOT_BASELINE = 344;
const FOOT_INSET = 42;
const SEAL_FOOT_INSET = 70;

function motifPaths(stamp: ShopStampDesign): readonly string[] {
  return stamp.tier === "country"
    ? SEAL_DEVICE_PATHS
    : STAMP_MOTIF_PATHS[stamp.motif];
}

/**
 * One impression, one ink.
 *
 * The ink is already chosen and pinned on the design; this component never
 * decides it and never mixes two. Dual-ink and spectrum impressions are a future
 * edition and have no code path here.
 *
 * ## Three anatomies, one material
 *
 * WP5's brief was that a seal must belong to the same family as a shop stamp
 * while staying recognisably a different kind of artefact — and that the
 * difference be carried by anatomy, framing, typography and hierarchy rather
 * than by colour, because no ink in this system is allowed to mean anything.
 *
 * - **A shop stamp** is asymmetric: the shop's own name reads from the left, its
 *   motif is pressed to the right. Rounded frame.
 * - **A locality seal** is symmetric: the country named above, the locality's
 *   own name centred, its motif centred beneath. Cornered frame.
 * - **A country seal** is symmetric and led by the Nib Atlas device rather than
 *   by any one shop's motif, because a country seal is derived rather than
 *   pressed at a place. Double rule.
 *
 * All three share the tier overline, the foot rhythm, the ink treatment and the
 * frame weight. The paper they are pressed onto belongs to `ImpressionPlate`,
 * not to them.
 */
export function StampArt({
  stamp,
  title,
  localTitle,
  localTitleLang,
  subtitle,
  detail = "full",
}: StampArtProps) {
  const ink = `var(--ink-${stamp.ink})`;
  const filterId = `stamp-edge-${stamp.id}`;
  const grainId = `stamp-grain-${stamp.id}`;
  const isShop = stamp.tier === "shop";
  const compact = detail === "compact";

  /*
   * The name, fitted rather than merely shrunk.
   *
   * A shop stamp's text column stops short of its motif, so its name gets 340 of
   * the 600 units; a seal is centred and gets the full measure less the frame. A
   * name that does not fit wraps onto a second line rather than running under
   * the motif or out through the frame — the responsive brief asks for long
   * shop, locality and country names to wrap intentionally.
   */
  const fitted = fitStampTitle({
    title,
    maxWidth: compact ? (isShop ? 320 : 470) : isShop ? 340 : 500,
    sizes: compact
      ? isShop
        ? [62, 54, 46, 40, 34]
        : [58, 50, 44, 38, 32]
      : isShop
        ? [37, 33, 29, 25, 22]
        : [40, 35, 30, 26, 22],
  });

  const localFitted =
    localTitle && !compact
      ? fitStampTitle({ title: localTitle, maxWidth: 340, sizes: [26, 23, 20] })
      : null;

  const description = [
    `${TIER_LABEL[stamp.tier]} stamp`,
    title,
    isShop ? stamp.localityLabel : null,
    subtitle ? `collected ${subtitle}` : "not yet collected",
    `${STAMP_INK_LABELS[stamp.ink]} ink`,
  ]
    .filter(Boolean)
    .join(", ");

  /* Where the name block starts, and how the rest of the composition follows. */
  const nameTop = compact
    ? isShop
      ? 200
      : // Centred tiers hang their name block around a fixed optical centre, so
        // a second line grows in both directions instead of pushing down onto
        // the device below it.
        (stamp.tier === "country" ? 300 : 292) -
        ((fitted.lines.length - 1) * fitted.lineHeight) / 2
    : isShop
      ? 152
      : stamp.tier === "country"
        ? 268
        : 178;
  const nameBottom = nameTop + (fitted.lines.length - 1) * fitted.lineHeight;
  const localTop = nameBottom + 42;
  const localBottom = localFitted
    ? localTop + (localFitted.lines.length - 1) * localFitted.lineHeight
    : nameBottom;

  /* A locality's motif is pressed under its name in the full composition. */
  const localityDeviceTop = nameBottom + 20;

  const isCornered = stamp.tier === "locality";
  const footBaseline = isCornered ? SEAL_FOOT_BASELINE : FOOT_BASELINE;
  const footInset = isCornered ? SEAL_FOOT_INSET : FOOT_INSET;

  const device = motifPaths(stamp);
  const deviceTransform = compact
    ? isShop
      ? "translate(392 130) scale(1.42)"
      : stamp.tier === "country"
        ? "translate(246 92) scale(0.94)"
        : "translate(255 104) scale(0.76)"
    : isShop
      ? "translate(400 132)"
      : stamp.tier === "country"
        ? "translate(225 82) scale(1.25)"
        : `translate(258 ${localityDeviceTop}) scale(0.72)`;

  return (
    <figure
      className={styles.stamp}
      data-ink={stamp.ink}
      data-tier={stamp.tier}
      data-detail={detail}
    >
      <svg
        viewBox={`0 0 ${CANVAS.width} ${CANVAS.height}`}
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
            {isShop ? (
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
              x={isShop ? 42 : MIDDLE}
              y={compact ? (isShop ? 92 : 88) : isShop ? 76 : 70}
              textAnchor={isShop ? undefined : "middle"}
              className={compact ? styles.tierCompact : styles.tier}
              fill={ink}
              stroke="none"
              opacity="0.8"
            >
              {TIER_LABEL[stamp.tier].toUpperCase()}
            </text>

            {/*
              A locality seal names its country before it names itself: the
              country is the wider thing, and naming it first is what makes the
              centred block read as a place inside a hierarchy rather than as a
              shop. Dropped in the compact composition, where the surface around
              the impression already says it in readable text.
            */}
            {stamp.tier === "locality" && !compact ? (
              <text
                x={MIDDLE}
                y="118"
                textAnchor="middle"
                className={styles.parent}
                fill={ink}
                stroke="none"
                opacity="0.85"
              >
                {stamp.countryLabel.toUpperCase()}
              </text>
            ) : null}

            <g
              strokeWidth={compact && isShop ? 8 : stamp.tier === "locality" && !compact ? 9 : 7.4}
              transform={deviceTransform}
            >
              {device.map((d) => (
                <path key={d} d={d} strokeLinecap="round" strokeLinejoin="round" />
              ))}
            </g>

            {fitted.lines.map((line, index) => (
              <text
                key={`name-${String(index)}`}
                x={isShop ? 42 : MIDDLE}
                y={nameTop + index * fitted.lineHeight}
                textAnchor={isShop ? undefined : "middle"}
                className={styles.name}
                fontSize={fitted.fontSize}
                fill={ink}
                stroke="none"
              >
                {line}
              </text>
            ))}

            {localFitted
              ? localFitted.lines.map((line, index) => (
                  <text
                    key={`local-${String(index)}`}
                    x="42"
                    y={localTop + index * localFitted.lineHeight}
                    className={styles.local}
                    lang={localTitleLang}
                    direction={
                      localTitleLang === undefined
                        ? undefined
                        : languageDirection(localTitleLang)
                    }
                    unicodeBidi="plaintext"
                    fontSize={localFitted.fontSize}
                    fill={ink}
                    stroke="none"
                  >
                    {line}
                  </text>
                ))
              : null}

            {isShop && !compact ? (
              <text
                x="42"
                y={Math.min(localBottom + 56, 300)}
                className={styles.parent}
                fill={ink}
                stroke="none"
                opacity="0.85"
              >
                {`${stamp.localityLabel} · ${stamp.countryLabel}`.toUpperCase()}
              </text>
            ) : null}

            {subtitle && !compact ? (
              <text
                x={footInset}
                y={footBaseline}
                className={styles.date}
                fill={ink}
                stroke="none"
              >
                {subtitle}
              </text>
            ) : null}
            {compact ? null : (
              <text
                x={CANVAS.width - footInset}
                y={footBaseline}
                textAnchor="end"
                className={styles.provenance}
                fill={ink}
                stroke="none"
                opacity="0.85"
              >
                NIB ATLAS
              </text>
            )}
          </g>
        </g>
      </svg>
    </figure>
  );
}
