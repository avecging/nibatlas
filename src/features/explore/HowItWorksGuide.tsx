"use client";

import { useRef, useState } from "react";

import { NibAtlasMark } from "@/src/components/brand/NibAtlasMark";
import { useDialogFocus } from "@/src/components/hooks/useDialogFocus";
import { useMediaQuery } from "@/src/components/hooks/useMediaQuery";
import { ImpressionPlate } from "@/src/components/stamps/ImpressionPlate";
import { ImpressionSheet } from "@/src/components/stamps/ImpressionSheet";
import { StampArt } from "@/src/components/stamps/StampArt";
import ceremonyStyles from "@/src/components/stamps/StampCeremony.module.css";
import { Icon } from "@/src/components/ui/Icon";
import type { ShopStampDesign } from "@/src/domain/shop-detail";

import styles from "./HowItWorksGuide.module.css";

const slides = [
  { title: "Welcome to Nib Atlas", copy: "Find fountain pen shops and collect digital stamps as you visit." },
  { title: "Discover shops", copy: "Explore the map to find fountain pen shops around the world." },
  { title: "Visit & collect", copy: "Visit a shop in person and check in there to collect its stamp." },
  { title: "Three kinds of stamps", copy: "Collect a shop stamp when you visit. Your visits also count toward locality and country seals." },
  { title: "Your passport", copy: "Your collected stamps become a personal record of your fountain pen journey." },
] as const;

// Specimens use the same generated artwork as issued impressions. The names are
// explicitly illustrative; opening this guide never checks in or issues a stamp.
function specimen(tier: ShopStampDesign["tier"], ink: ShopStampDesign["ink"], shape?: ShopStampDesign["generatedShopSeal"]): ShopStampDesign {
  return {
    id: "guide-" + tier + "-" + ink + (shape ?? ""),
    tier, ink, motif: "nib", localityLabel: "Singapore",
    countryLabel: "Singapore", designVersion: 1, paletteVersion: 1,
    ...(tier === "shop" ? { generatedShopSeal: shape ?? "shield" } : { generatedSealTemplate: "cartouche-v2" as const }),
  };
}

const country = specimen("country", "navy");
const locality = specimen("locality", "teal");
const shopShields = [
  specimen("shop", "plum", "shield"),
  specimen("shop", "moss", "oval"),
  specimen("shop", "vermilion", "rectangle"),
] as const;

export function HowItWorksGuide({ onClose }: { readonly onClose: () => void }) {
  const [index, setIndex] = useState(0);
  const dialogRef = useDialogFocus<HTMLDivElement>(true, onClose);
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const go = (next: number) => setIndex(Math.max(0, Math.min(slides.length - 1, next)));
  const slide = slides[index];

  return (
    <ImpressionSheet tier="How Nib Atlas works" closeLabel="Close guide"
      dialogRef={dialogRef} labelledBy="how-it-works-title"
      onClose={onClose} testId="how-it-works-guide"
      dialogProps={{ "data-guide-slide": String(index + 1) }}>
      <div className={styles.body}
        onTouchStart={(event) => { const touch = event.touches[0]; if (touch) touchStart.current = { x: touch.clientX, y: touch.clientY }; }}
        onTouchEnd={(event) => {
          const start = touchStart.current;
          const touch = event.changedTouches[0];
          touchStart.current = null;
          if (!start || !touch) return;
          const dx = touch.clientX - start.x, dy = touch.clientY - start.y;
          if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.5) go(index + (dx < 0 ? 1 : -1));
        }}>
        <div className={styles.art} aria-hidden="true">
          {index === 0 ? <NibAtlasMark size={112} title="Nib Atlas" /> : null}
          {index === 1 ? <div className={styles.discovery}><Icon name="map" size={76} /><span>Find your next shop</span></div> : null}
          {index === 2 ? (
            <div key="press" className={ceremonyStyles.press} data-phase={reducedMotion ? "settled" : "pressing"} data-reduced={reducedMotion ? "true" : "false"}>
              <span className={ceremonyStyles.contactShadow} />
              <ImpressionPlate className={ceremonyStyles.plate} size="detail">
                <StampArt stamp={shopShields[0]} title="Sample shop" />
              </ImpressionPlate>
              <span className={ceremonyStyles.pressFlash} />
            </div>
          ) : null}
          {index === 3 ? (
            <div className={styles.seals}>
              <div className={styles.locality}><StampArt stamp={locality} title="Singapore" /></div>
              <div className={styles.shopOne}><StampArt stamp={shopShields[0]} title="Sample shop" /></div>
              <div className={styles.shopTwo}><StampArt stamp={shopShields[1]} title="Sample shop" /></div>
              <div className={styles.shopThree}><StampArt stamp={shopShields[2]} title="Sample shop" /></div>
              <div className={styles.country}><StampArt stamp={country} title="Singapore" /></div>
            </div>
          ) : null}
          {index === 4 ? <div className={styles.passport}><span>My Passport</span><StampArt stamp={country} title="Singapore" /><StampArt stamp={shopShields[1]} title="Sample shop" /></div> : null}
        </div>
        <h2 id="how-it-works-title" className={styles.title}>{slide.title}</h2>
        <p className={styles.copy}>{slide.copy}</p>
        {index >= 2 ? <p className={styles.specimen}>Illustrative stamp examples · No visit recorded</p> : null}
      </div>
      <div className={styles.footer}>
        <div className={styles.progress} aria-label={"Slide " + (index + 1) + " of " + slides.length}>
          {slides.map((item, step) => (
            <button key={item.title} type="button" className={styles.dot}
              aria-label={"Go to slide " + (step + 1) + ": " + item.title}
              aria-current={step === index ? "step" : undefined}
              onClick={() => go(step)} />
          ))}
        </div>
        <div className={styles.actions}>
          <button type="button" className={styles.back} disabled={index === 0} onClick={() => go(index - 1)}>Back</button>
          <button type="button" className={styles.next} onClick={index === slides.length - 1 ? onClose : () => go(index + 1)}>
            {index === slides.length - 1 ? "Done" : "Next"}
          </button>
        </div>
      </div>
    </ImpressionSheet>
  );
}
