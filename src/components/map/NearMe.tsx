"use client";

import { Icon } from "@/src/components/ui/Icon";
import type { useNearMe } from "@/src/features/map/use-near-me";
import styles from "./NearMe.module.css";

export function NearMe({ location }: { readonly location: ReturnType<typeof useNearMe> }) {
  return (
    <div className={styles.control}>
      <button className={`${styles.button} ${styles.locateButton}`} type="button" onClick={location.explain}
        aria-label={location.status === "locating" ? "Finding you…" : "Near me"}
        title="Near me" aria-busy={location.status === "locating"}
        disabled={location.status === "locating"} aria-expanded={location.status !== "idle"}>
        <Icon name="locate" size={22} />
      </button>
      {location.status !== "idle" ? (
        <div className={styles.panel}>
          <p role={location.status === "error" ? "alert" : "status"}>
            {location.status === "error" ? location.message
              : location.status === "locating" ? "Finding your area…"
                : "Use your location once to find nearby shops. Only your approximate area is used on the map; your exact position isn’t saved."}
          </p>
          <div className={styles.actions}>
            {location.status !== "locating" ? (
              <button className={styles.button} type="button" onClick={() => void location.locate()}>
                {location.status === "error" ? "Try again" : "Use my location"}
              </button>
            ) : null}
            <button className={styles.button} type="button" onClick={location.cancel}>Cancel</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
