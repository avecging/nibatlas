"use client";
/* eslint-disable @next/next/no-img-element -- Publication-checked same-origin delivery; no persistent image proxy or optimiser cache. */

import { useState } from "react";

import { useShopMedia } from "@/src/components/shops/ShopMediaProvider";
import { logoShape } from "@/src/features/shops/shop-media";

import styles from "./ShopMedia.module.css";

/**
 * The business's own logo, beside the shop's name.
 *
 * A logo is that shop's identity, not a picture of it: it is drawn in the
 * identity header, never in the gallery, and never counted as a photograph. The
 * source image is preserved whole — `object-fit: contain` inside a bounded slot,
 * with no crop, mask, recolouring or background removal — and the slot the mark
 * gets is chosen from the intrinsic dimensions the media contract already
 * carries.
 *
 * A record with no logo gets a text-led identity and no reserved square. So does
 * one whose logo is still loading or will not load: the title, the bookmark and
 * the actions never wait on an image.
 */
export function ShopLogoMark() {
  const { logo, srcFor } = useShopMedia();
  const [broken, setBroken] = useState<string | null>(null);

  if (!logo || broken === logo.id) {
    return null;
  }

  return (
    <span className={styles.logoSlot} data-shape={logoShape(logo)}>
      <img
        className={styles.logoImage}
        src={srcFor(logo.id)}
        alt={logo.altText}
        width={logo.width}
        height={logo.height}
        onError={() => setBroken(logo.id)}
      />
    </span>
  );
}
