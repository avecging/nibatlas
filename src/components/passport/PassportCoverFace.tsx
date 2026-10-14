import { NibAtlasMark } from "@/src/components/brand/NibAtlasMark";

import styles from "./PassportBook.module.css";

/** The same cover face shown on the Passport screen and in the map guide. */
export function PassportCoverFace() {
  return (
    <div className={styles.coverFace} data-face="front" data-passport-cover="">
      <span className={styles.coverStock} />
      <span className={styles.coverIssuer}>Nib Atlas</span>
      <span className={styles.coverInner}>
        <NibAtlasMark size={92} tone="single" className={styles.coverMark} />
        <span className={styles.coverTitle}>Passport</span>
      </span>
      <span className={styles.coverFoot}>Volume I</span>
    </div>
  );
}
