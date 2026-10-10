import { BackToSafety } from "./BackToSafety";
import styles from "./OffTheMap.module.css";

type ErrorVariant = "missing" | "denied";

const copy: Record<ErrorVariant, { stamp: string; description: string }> = {
  missing: {
    stamp: "404",
    description: "The trail ends here. This page may have moved, or perhaps it was never on the map.",
  },
  denied: {
    stamp: "ACCESS DENIED",
    description: "This part of the atlas is reserved for its keepers. Your journey can continue elsewhere.",
  },
};

/** Shared presentation only. Access checks must happen on the server. */
export function OffTheMap({ variant = "missing" }: { variant?: ErrorVariant }) {
  const message = copy[variant];
  return (
    <section className={styles.page} aria-labelledby="off-map-title">
      <div className={styles.sheet}>
        <div className={styles.cornerTop} aria-hidden="true">N · A / FIELD NOTES</div>
        <div className={styles.cornerNumber} aria-hidden="true">NO. 000</div>
        <div className={styles.art} aria-hidden="true">
          <svg className={styles.map} viewBox="0 0 600 370" fill="none">
            <defs>
              <pattern id="atlas-grid" width="32" height="32" patternUnits="userSpaceOnUse"><path d="M32 0H0V32" stroke="currentColor" strokeOpacity=".10" strokeWidth=".7"/></pattern>
            </defs>
            <rect width="600" height="370" fill="url(#atlas-grid)"/>
            <path d="M-20 110C77 18 145 114 218 52S361 68 426 24 527 78 629-6M-20 146C81 54 144 150 226 88S367 103 435 61 531 117 627 39M-20 186C90 89 149 187 242 124S380 146 450 101 542 155 628 77M-20 244C98 139 169 232 254 169S388 193 469 149 543 190 628 118M-20 290C115 190 183 280 274 208S403 244 485 196 566 229 634 169" stroke="currentColor" strokeOpacity=".24" strokeWidth="1.2"/>
            <path d="M85 308C125 287 144 304 171 270S211 209 263 226 298 177 338 170 380 114 433 115" stroke="var(--teal-700)" strokeWidth="3" strokeLinecap="round" strokeDasharray="2 11"/>
            <circle cx="85" cy="308" r="7" fill="var(--teal-700)"/>
            <circle cx="85" cy="308" r="13" stroke="var(--teal-700)" strokeOpacity=".35"/>
            <path d="m430 98 23 18-23 18-23-18z" stroke="var(--atlas-900)" strokeWidth="1.7"/>
            <path d="m430 98 0 36m-23-18h46" stroke="var(--atlas-900)" strokeWidth="1.1"/>
            <path d="M530 66v61m-31-31h62" stroke="var(--atlas-900)" strokeOpacity=".65"/>
            <path d="m530 66-8 22 8-5 8 5zm0 61-8-22 8 5 8-5z" fill="var(--atlas-900)" fillOpacity=".65"/>
            <text x="530" y="55" textAnchor="middle" fontSize="12" letterSpacing="2" fill="var(--atlas-900)">N</text>
            <text x="51" y="67" fontSize="11" letterSpacing="3" fill="var(--atlas-900)" opacity=".7">UNMAPPED TERRITORY</text>
            <text x="344" y="292" fontSize="13" fontFamily="serif" fontStyle="italic" fill="var(--atlas-900)" opacity=".7">Here the trail fades...</text>
            <path d="M360 300q34 7 67-3" stroke="var(--atlas-900)" strokeOpacity=".4"/>
          </svg>
          <div className={styles.stamp} data-kind={variant}>
            <div className={styles.stampInner}>
              <span className={styles.stampArc}>NIB ATLAS · WAYFINDER</span>
              <strong>{message.stamp}</strong>
              <span className={styles.stampFooter}>NO ROUTE FOUND</span>
            </div>
          </div>
        </div>
        <div className={styles.content}>
          <p className={styles.eyebrow}>AN UNEXPECTED DETOUR</p>
          <h1 id="off-map-title">Off the map.</h1>
          <p className={styles.description}>{message.description}</p>
          <BackToSafety />
        </div>
        <p className={styles.footnote}>Find your way. Leave an impression.</p>
      </div>
    </section>
  );
}
