import type { ReactNode } from "react";

import { Icon, type IconName } from "@/src/components/ui/Icon";
import type { MarkerState, OperationalStatus } from "@/src/domain/shops";
import { OPERATIONAL_STATUS_LABELS } from "@/src/domain/shop-detail";

import styles from "./StatusBadge.module.css";

export type Tone =
  | "visited"
  | "saved"
  | "unvisited"
  | "neutral"
  /** Confirmed open: the one status worth a positive colour. */
  | "success"
  /** Confirmed closed, temporarily or permanently: the loudest status. */
  | "warning"
  /** Unconfirmed: present, legible, and quieter than a real closure. */
  | "caution"
  | "prototype";

interface BadgeProps {
  readonly tone: Tone;
  readonly icon?: IconName;
  readonly children: ReactNode;
}

export function Badge({ tone, icon, children }: BadgeProps) {
  return (
    <span className={`${styles.badge} ${styles[tone]}`}>
      {icon ? <Icon name={icon} size={14} /> : null}
      {children}
    </span>
  );
}

const MARKER_STATE_BADGE: Record<MarkerState, { tone: Tone; icon: IconName; label: string }> = {
  visited: { tone: "visited", icon: "seal", label: "Visited" },
  saved: { tone: "saved", icon: "bookmark-filled", label: "Saved" },
  unvisited: { tone: "unvisited", icon: "bookmark", label: "Not visited" },
};

export function MarkerStateBadge({ state }: { readonly state: MarkerState }) {
  const config = MARKER_STATE_BADGE[state];

  return (
    <Badge tone={config.tone} icon={config.icon}>
      {config.label}
    </Badge>
  );
}

/**
 * How much attention each operational status is allowed to take.
 *
 * Exported so the hierarchy can be asserted directly: CSS modules are not
 * processed in the unit run, so a class-name assertion would test nothing. The
 * rendered colours are asserted in `tests/e2e/shop-value.spec.ts`.
 */
export const OPERATIONAL_STATUS_TONE: Record<OperationalStatus, Tone> = {
  open: "success",
  temporarily_closed: "warning",
  permanently_closed: "warning",
  unknown: "caution",
};

export function OperationalStatusBadge({
  status,
}: {
  readonly status: OperationalStatus;
}) {
  /*
   * Three levels of attention, not two.
   *
   * The first staging review made `Status not confirmed` amber, because as a
   * neutral badge a shop nobody had verified read like one that had been. The
   * second review found the fix overshot: strong amber now competed with an
   * actual closure, which is the state a traveller most needs to see.
   *
   * So the hierarchy is explicit. A confirmed closure keeps the filled amber. An
   * unconfirmed status keeps amber and the alert icon but steps back to a soft
   * outline and secondary ink. `Open` — the fact that most changes whether a
   * trip is worth making, and the one the map surfaces needed to show — gets the
   * success green rather than the neutral grey it had.
   *
   * Wording and operational meaning are unchanged in every case.
   */
  const tone = OPERATIONAL_STATUS_TONE[status];

  return (
    <Badge tone={tone} icon={status === "open" ? "check" : "alert"}>
      {OPERATIONAL_STATUS_LABELS[status]}
    </Badge>
  );
}

/**
 * The prototype-data notice. `BRAND.md` and the acceptance brief allow it at
 * environment or page level only — never inside a search field, a status
 * control, or a shop fact.
 */
export function PrototypeBadge({
  children = "Prototype data",
}: {
  readonly children?: ReactNode;
}) {
  return <Badge tone="prototype">{children}</Badge>;
}
