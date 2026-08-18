import type { Metadata } from "next";

import { NibAtlasMark } from "@/src/components/brand/NibAtlasMark";
import { StampArt } from "@/src/components/stamps/StampArt";
import { Button } from "@/src/components/ui/Button";
import { Icon } from "@/src/components/ui/Icon";
import {
  DemoBadge,
  MarkerStateBadge,
  OperationalStatusBadge,
} from "@/src/components/ui/StatusBadge";
import { markerGlyph, clusterGlyph } from "@/src/components/map/marker-markup";
import type { MarkerState } from "@/src/domain/shops";
import { demoShopDetails } from "@/src/fixtures/demo-catalogue";

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

const MARKER_STATES: readonly MarkerState[] = ["unvisited", "saved", "visited"];

export default function StyleguidePage() {
  // One sample per regional ink, with distinct motifs.
  const stampSlugs = [
    "demo-ginza-fountain-pen-salon",
    "demo-chinatown-vintage-nibs",
    "demo-bugis-ink-atelier",
    "demo-hualien-coastline-pen-stop",
    "demo-kanazawa-lacquer-pen-room",
  ];
  const stampSamples = stampSlugs
    .map((slug) => demoShopDetails.find((shop) => shop.slug === slug))
    .filter((shop): shop is (typeof demoShopDetails)[number] => shop !== undefined);

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

      <section className={styles.section} aria-labelledby="brand">
        <h2 className={styles.title} id="brand">
          Provisional mark
        </h2>
        <div className={styles.row} style={{ color: "var(--atlas-900)" }}>
          <NibAtlasMark size={20} title="Nib Atlas at 20 px" />
          <NibAtlasMark size={32} title="Nib Atlas at 32 px" />
          <NibAtlasMark size={64} title="Nib Atlas at 64 px" />
          <NibAtlasMark size={120} title="Nib Atlas at 120 px" />
        </div>
        <p className="type-body-sm">
          Placeholder construction only. `BRAND.md` requires a commissioned SVG master
          before public launch.
        </p>
      </section>

      <section className={styles.section} aria-labelledby="controls">
        <h2 className={styles.title} id="controls">
          Controls
        </h2>
        <div className={styles.row}>
          <Button variant="primary">Primary</Button>
          <Button variant="secondary">
            <Icon name="bookmark" size={18} />
            Save
          </Button>
          <Button variant="quiet">Quiet</Button>
          <Button variant="stamp">
            <Icon name="seal" size={18} />
            Collect Stamp
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
          <OperationalStatusBadge status="unknown" />
          <DemoBadge />
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

      <section className={styles.section} aria-labelledby="stamps">
        <h2 className={styles.title} id="stamps">
          Atlas Stamps
        </h2>
        <div className={styles.stamps}>
          {stampSamples.map((shop) => (
            <StampArt
              key={shop.slug}
              stamp={shop.stamp}
              shopName={shop.name}
              collectedOn="2026-06-12"
            />
          ))}
        </div>
      </section>
    </div>
  );
}
