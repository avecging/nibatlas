"use client";

import { Icon } from "@/src/components/ui/Icon";

import styles from "./SearchThisArea.module.css";

interface SearchThisAreaProps {
  readonly mode: "offer" | "loading" | "error" | "hidden";
  readonly onSearch: () => void;
}

/**
 * The only way a moved viewport becomes a query. Pan and zoom never refetch.
 */
export function SearchThisArea({ mode, onSearch }: SearchThisAreaProps) {
  if (mode === "hidden") {
    return null;
  }

  if (mode === "loading") {
    return (
      <p className={`${styles.pill} ${styles.loading}`} role="status">
        <span className={styles.spinner} aria-hidden="true" />
        Searching this area…
      </p>
    );
  }

  if (mode === "error") {
    return (
      <button type="button" className={`${styles.pill} ${styles.error}`} onClick={onSearch}>
        <Icon name="alert" size={18} />
        Search failed — Retry
      </button>
    );
  }

  return (
    <button type="button" className={styles.pill} onClick={onSearch}>
      <Icon name="search" size={18} />
      Search this area
    </button>
  );
}
