"use client";

import type { ReactNode } from "react";

import { Icon } from "@/src/components/ui/Icon";

import styles from "./Chip.module.css";

interface ChipProps {
  readonly pressed: boolean;
  readonly onToggle: () => void;
  readonly intent?: "default" | "saving";
  readonly children: ReactNode;
}

export function Chip({ pressed, onToggle, intent = "default", children }: ChipProps) {
  return (
    <button
      type="button"
      className={`${styles.chip} ${intent === "saving" ? styles.intent : ""}`}
      aria-pressed={pressed}
      onClick={onToggle}
    >
      {pressed ? (
        <span className={styles.check}>
          <Icon name="check" size={14} />
        </span>
      ) : null}
      {children}
    </button>
  );
}
