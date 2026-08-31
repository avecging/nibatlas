import type { ReactNode } from "react";

import styles from "./ImpressionPlate.module.css";

/**
 * How much room the plate is being given.
 *
 * Not a style choice per surface — one material at four scales:
 *
 * - `thumb` — a List row's impression, at about 4.75 rem. Pressed square,
 *   because a tilt at that size costs legibility.
 * - `page` — an impression or seal on a book page, sized in `em` so it tracks
 *   the leaf's own scale.
 * - `card` — a seal beside a section heading in List mode.
 * - `detail` — the enlarged impression: the overlay, and the ceremony's press
 *   plate.
 */
export type ImpressionPlateSize = "thumb" | "page" | "card" | "detail";

/**
 * The paper an impression is pressed onto.
 *
 * WP5's first finding was that this did not exist. The collection ceremony drew
 * a bordered paper ground under the impression; the Passport's enlarged overlay
 * drew the impression straight onto the dialog; List rows and book pages drew it
 * onto whatever happened to be behind them. Three approximations of one idea, so
 * the enlarged Passport impression and the collected impression a shop page
 * shows did not read as the same object.
 *
 * This is that one object. It owns the stock, the hairline edge, the paper
 * tooth, the pressed depth and the single press angle, all from the
 * `--impression-*` tokens; a surface picks a size and supplies the impression.
 * Nothing else may put an Atlas Stamp or a derived seal on a ground of its own.
 */
export function ImpressionPlate({
  children,
  size,
  collected = true,
  className,
}: {
  /** The impression. In practice always a `StampArt`. */
  readonly children: ReactNode;
  readonly size: ImpressionPlateSize;
  /**
   * Whether this impression has been pressed.
   *
   * Everything in the Passport is collected by definition — an impression only
   * exists once it has been. The uncollected treatment is for specimens, and it
   * is a lighter ink on the same sheet rather than a locked silhouette.
   */
  readonly collected?: boolean;
  readonly className?: string | undefined;
}) {
  return (
    <span
      className={`${styles.plate}${className ? ` ${className}` : ""}`}
      data-plate-size={size}
      data-plate-state={collected ? "collected" : "uncollected"}
    >
      {/*
        `data-impression` is the one hook a caller may reach for: the collection
        ceremony presses this element onto the paper around it. Nothing else may
        restyle it.
      */}
      <span className={styles.impression} data-impression="">
        {children}
      </span>
    </span>
  );
}
