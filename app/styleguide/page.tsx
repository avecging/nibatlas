import type { Metadata } from "next";

import { NibAtlasMark } from "@/src/components/brand/NibAtlasMark";
import { ShopIdentityHero } from "@/src/components/shops/ShopIdentityHero";
import {
  ShopExclusives,
  ShopValueGap,
  ShopWhatYouCanDo,
} from "@/src/components/shops/ShopValueSections";
import { ImpressionPlate } from "@/src/components/stamps/ImpressionPlate";
import { StampArt } from "@/src/components/stamps/StampArt";
import { Button } from "@/src/components/ui/Button";
import { Icon } from "@/src/components/ui/Icon";
import {
  MarkerStateBadge,
  OperationalStatusBadge,
  PrototypeBadge,
} from "@/src/components/ui/StatusBadge";
import { markerGlyph, clusterGlyph } from "@/src/components/map/marker-markup";
import type { MarkerState } from "@/src/domain/shops";
import { findPrototypeShop, PROTOTYPE_DESIGN_VERSION } from "@/src/fixtures/prototype-catalogue";
import {
  SHOP_VALUE_SPECIMEN_NOTICE,
  shopValueSpecimen,
} from "@/src/fixtures/shop-value-specimen";
import {
  inkForStampKey,
  STAMP_INKS,
  STAMP_INK_LABELS,
  STAMP_PALETTE_VERSION,
} from "@/src/domain/stamp-palette";
import type { StampMotif } from "@/src/domain/shop-detail";

import styles from "./styleguide.module.css";

export const metadata: Metadata = {
  title: "Component styleguide",
  description: "Internal component states for Milestone 1 review.",
  robots: { index: false, follow: false },
};

const TOKENS = [
  "--paper-50",
  "--paper-100",
  "--paper-200",
  "--atlas-900",
  "--sumi-950",
  "--sumi-700",
  "--teal-700",
  "--vermilion-700",
  "--indigo-700",
  "--brass-600",
];

const MOTIF_SAMPLES: readonly StampMotif[] = [
  "storefront",
  "shophouse",
  "ink-bottle",
  "nib",
  "arcade",
  "harbour",
  "counter",
  "workbench",
];

const MARKER_STATES: readonly MarkerState[] = ["unvisited", "saved", "visited"];

export default function StyleguidePage() {
  const gapExample = findPrototypeShop("juspirit-banqiao");

  return (
    <div className={styles.page}>
      <header>
        <p className="type-overline">Internal</p>
        <h1 className="type-display">Component styleguide</h1>
        <p className="type-body-lg">
          Milestone 1 component states. Review at 360 × 800, 768 × 1024, and 1440 × 900.
        </p>
      </header>

      <section className={styles.section} aria-labelledby="tokens">
        <h2 className={styles.title} id="tokens">
          Colour tokens
        </h2>
        <div className={styles.swatches}>
          {TOKENS.map((token) => (
            <div className={styles.swatch} key={token}>
              <span className={styles.chip} style={{ background: `var(${token})` }} />
              <code>{token}</code>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.section} aria-labelledby="typography">
        <h2 className={styles.title} id="typography">
          Type scale
        </h2>
        <p className="type-display">Display · Passport moment</p>
        <p className="type-h1">H1 · Page title</p>
        <p className="type-h2">H2 · Section title</p>
        <p className="type-h3">H3 · Component heading</p>
        <p className="type-body-lg">Body large · introductory copy</p>
        <p>Body · default content</p>
        <p className="type-body-sm">Body small · supporting content</p>
        <p className="type-label">Label · controls</p>
        <p className="type-caption">Caption · dates and sources</p>
        <p className="type-h2" lang="ja">
          デモ銀座萬年筆サロン・書斎と試筆室
        </p>
        <p className="type-h2" lang="zh-Hant">
          示範台北大安墨水圖書室與試寫空間
        </p>
      </section>

      <section className={styles.section} aria-labelledby="inks">
        <h2 className={styles.title} id="inks">
          Stamp inks · palette v{STAMP_PALETTE_VERSION}
        </h2>
        <p className="type-body-sm">
          Eight shared global inks. A standard stamp uses exactly one. No ink
          belongs to a country, locality, tier, rarity, or achievement, and no
          impression mixes two.
        </p>
        <div className={styles.swatches}>
          {STAMP_INKS.map((ink) => (
            <div className={styles.swatch} key={ink}>
              <span
                className={styles.chip}
                style={{ background: `var(--ink-${ink})` }}
              />
              <code>{STAMP_INK_LABELS[ink]}</code>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.section} aria-labelledby="brand">
        <h2 className={styles.title} id="brand">
          Brand mark
        </h2>
        <div className={styles.row} style={{ color: "var(--atlas-900)" }}>
          <NibAtlasMark size={20} title="Nib Atlas at 20 px" />
          <NibAtlasMark size={32} title="Nib Atlas at 32 px" />
          <NibAtlasMark size={64} title="Nib Atlas at 64 px" />
          <NibAtlasMark size={120} title="Nib Atlas at 120 px" />
        </div>
        <div className={styles.row} style={{ background: "var(--atlas-900)", padding: "1rem", color: "var(--foil-bright)" }}>
          <NibAtlasMark size={64} tone="single" title="One-colour imprint" />
        </div>
        <p className="type-body-sm">
          The founder&rsquo;s drawn mark. `BRAND.md` still requires simplified
          small-size artwork before public launch; below about 20 px the globe grid
          closes up, so the one-colour tone is preferred in imprint contexts.
        </p>
      </section>

      <section className={styles.section} aria-labelledby="controls">
        <h2 className={styles.title} id="controls">
          Controls
        </h2>
        <div className={styles.row}>
          <Button variant="primary">Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="quiet">
            <Icon name="directions" size={18} />
            Directions
          </Button>
          <Button variant="stamp">
            <Icon name="seal" size={18} />
            Collect Stamp
          </Button>
          <Button variant="collected">
            <Icon name="seal" size={18} />
            View Atlas Stamp
          </Button>
          <Button variant="primary" disabled>
            Disabled
          </Button>
        </div>
        <div className={styles.row}>
          {MARKER_STATES.map((state) => (
            <MarkerStateBadge key={state} state={state} />
          ))}
          <OperationalStatusBadge status="open" />
          <OperationalStatusBadge status="temporarily_closed" />
          <OperationalStatusBadge status="permanently_closed" />
          <OperationalStatusBadge status="unknown" />
          <PrototypeBadge />
        </div>
      </section>

      <section className={styles.section} aria-labelledby="markers">
        <h2 className={styles.title} id="markers">
          Map markers
        </h2>
        <div className={styles.markers}>
          {MARKER_STATES.map((state) => (
            <span className={styles.markerCell} key={state}>
              <span
                style={{
                  color:
                    state === "visited"
                      ? "var(--state-visited)"
                      : state === "saved"
                        ? "var(--state-saved)"
                        : "var(--state-unvisited)",
                }}
                // Marker glyphs are static, author-controlled SVG strings.
                dangerouslySetInnerHTML={{ __html: markerGlyph(state, false) }}
              />
              {state}
            </span>
          ))}
          {MARKER_STATES.map((state) => (
            <span className={styles.markerCell} key={`${state}-selected`}>
              <span
                style={{
                  color:
                    state === "visited"
                      ? "var(--state-visited)"
                      : state === "saved"
                        ? "var(--state-saved)"
                        : "var(--state-unvisited)",
                }}
                dangerouslySetInnerHTML={{ __html: markerGlyph(state, true) }}
              />
              {state} · selected
            </span>
          ))}
          <span className={styles.markerCell}>
            <span dangerouslySetInnerHTML={{ __html: clusterGlyph(12) }} />
            cluster
          </span>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="shop-value">
        <h2 className={styles.title} id="shop-value">
          Shop value layer
        </h2>
        <p className="type-body-sm">
          Populated and empty states of the pen-specific sections. No source in
          the prototype catalogue publishes a service, an in-store experience or
          a shop-only item, so every real shop page shows the gap state; the
          populated state is drawn from a specimen record that exists only here.
          <strong>What you can do there</strong> is kept here only: since
          20 September the public page answers that question once, through
          published editorial, and this section is no longer rendered on it.
        </p>
        <div className={styles.shopValue}>
          <PrototypeBadge>{SHOP_VALUE_SPECIMEN_NOTICE}</PrototypeBadge>
          <ShopIdentityHero shop={shopValueSpecimen} titleAs="p" />
          <ShopWhatYouCanDo shop={shopValueSpecimen} />
          <ShopExclusives shop={shopValueSpecimen} />
        </div>
        <p className="type-body-sm">
          The same sections on a real record with nothing sourced: one concise
          caution and the contribution invitation, never a list of empty fields.
        </p>
        <div className={styles.shopValue}>
          {gapExample ? <ShopValueGap shop={gapExample} /> : null}
        </div>
      </section>

      <section className={styles.section} aria-labelledby="stamps">
        <h2 className={styles.title} id="stamps">
          Atlas Stamps
        </h2>
        <p className="type-body-sm">
          Frame anatomy carries tier, never colour: rounded for a shop, cornered
          for a locality, double-ruled for a country.
        </p>
        <div className={styles.stamps} data-specimen="tier">
          {(["shop", "locality", "country"] as const).map((tier) => (
            <figure className={styles.specimen} key={tier}>
              <ImpressionPlate size="detail">
                <StampArt
                  stamp={{
                    id: `styleguide-${tier}`,
                    tier,
                    motif: "storefront",
                    ink: inkForStampKey(`styleguide-${tier}`),
                    localityLabel: "Chūō, Tokyo",
                    countryLabel: "Japan",
                    designVersion: PROTOTYPE_DESIGN_VERSION,
                    paletteVersion: STAMP_PALETTE_VERSION,
                  }}
                  title={
                    tier === "country"
                      ? "Japan"
                      : tier === "locality"
                        ? "Chūō, Tokyo"
                        : "Ginza Itoya Main Store"
                  }
                  subtitle="2026-03-14"
                />
              </ImpressionPlate>
              <figcaption className={styles.specimenCaption}>
                {tier} · enlarged
              </figcaption>
            </figure>
          ))}
        </div>

        <p className="type-body-sm">
          The same three artefacts in the compact composition a List row and a
          book page give them: the lines that cannot be read at that size are
          dropped rather than pressed illegibly, and the surface around the
          impression states them in real text.
        </p>
        <div className={styles.stamps} data-specimen="compact">
          {(["shop", "locality", "country"] as const).map((tier) => (
            <figure className={styles.specimen} key={tier}>
              <ImpressionPlate size="thumb">
                <StampArt
                  detail="compact"
                  stamp={{
                    id: `styleguide-${tier}`,
                    tier,
                    motif: "storefront",
                    ink: inkForStampKey(`styleguide-${tier}`),
                    localityLabel: "Chūō, Tokyo",
                    countryLabel: "Japan",
                    designVersion: PROTOTYPE_DESIGN_VERSION,
                    paletteVersion: STAMP_PALETTE_VERSION,
                  }}
                  title={
                    tier === "country"
                      ? "Japan"
                      : tier === "locality"
                        ? "Chūō, Tokyo"
                        : "Ginza Itoya Main Store"
                  }
                />
              </ImpressionPlate>
              <figcaption className={styles.specimenCaption}>
                {tier} · compact
              </figcaption>
            </figure>
          ))}
        </div>

        <p className="type-body-sm">
          A long name wraps inside the impression rather than being shrunk until
          it fits on one line or run under the motif.
        </p>
        <div className={styles.stamps} data-specimen="long-name">
          <figure className={styles.specimen}>
            <ImpressionPlate size="detail">
              <StampArt
                stamp={{
                  id: "styleguide-long-name",
                  tier: "shop",
                  motif: "counter",
                  ink: inkForStampKey("styleguide-long-name"),
                  localityLabel: "Chūō-ku, Kobe",
                  countryLabel: "Japan",
                  designVersion: PROTOTYPE_DESIGN_VERSION,
                  paletteVersion: STAMP_PALETTE_VERSION,
                }}
                title="NAGASAWA Stationery Center Main Store"
                localTitle="ナガサワ文具センター 本店"
                subtitle="2026-04-02"
              />
            </ImpressionPlate>
            <figcaption className={styles.specimenCaption}>
              shop · long name
            </figcaption>
          </figure>
          <figure className={styles.specimen}>
            <ImpressionPlate size="detail">
              <StampArt
                stamp={{
                  id: "styleguide-long-locality",
                  tier: "locality",
                  motif: "shophouse",
                  ink: inkForStampKey("styleguide-long-locality"),
                  localityLabel: "East District, Tainan",
                  countryLabel: "Taiwan",
                  designVersion: PROTOTYPE_DESIGN_VERSION,
                  paletteVersion: STAMP_PALETTE_VERSION,
                }}
                title="East District, Tainan"
                subtitle="2026-03-19"
              />
            </ImpressionPlate>
            <figcaption className={styles.specimenCaption}>
              locality · long name
            </figcaption>
          </figure>
        </div>
        <p className="type-body-sm">
          The eight motifs, on an uncollected sheet: the same paper with nothing
          pressed into it yet. Nowhere in the Passport shows one of these — an
          impression exists only once it has been collected — and none of them is
          a locked reward.
        </p>
        <div className={styles.stamps} data-specimen="motif">
          {MOTIF_SAMPLES.map((motif) => (
            <figure className={styles.specimen} key={motif}>
              <ImpressionPlate collected={false} size="thumb">
                <StampArt
                  detail="compact"
                  stamp={{
                    id: `styleguide-motif-${motif}`,
                    tier: "shop",
                    motif,
                    ink: inkForStampKey(`styleguide-motif-${motif}`),
                    localityLabel: "Motif",
                    countryLabel: "Nib Atlas",
                    designVersion: PROTOTYPE_DESIGN_VERSION,
                    paletteVersion: STAMP_PALETTE_VERSION,
                  }}
                  title={motif}
                />
              </ImpressionPlate>
              <figcaption className={styles.specimenCaption}>{motif}</figcaption>
            </figure>
          ))}
        </div>
      </section>
    </div>
  );
}
