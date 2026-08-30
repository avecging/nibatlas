import type { ReactNode } from "react";

import { Icon, type IconName } from "@/src/components/ui/Icon";
import type { MarkerState, OperationalStatus } from "@/src/domain/shops";
import { OPERATIONAL_STATUS_LABELS } from "@/src/domain/shop-detail";

import styles from "./StatusBadge.module.css";

type Tone = "visited" | "saved" | "unvisited" | "neutral" | "warning" | "prototype";

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

export function OperationalStatusBadge({
  status,
}: {
  readonly status: OperationalStatus;
}) {
  /*
   * Unknown is a caution, not a neutral fact.
   *
   * The founder's staging review of WP4: `Status not confirmed` blended into the
   * interface, so a shop nobody has verified read like one that had been. It now
   * shares the warning treatment with the closed statuses — amber, an alert
   * icon, and the same wording as before.
   */
  const tone: Tone = status === "open" ? "neutral" : "warning";

  return (
    <Badge tone={tone} icon={status === "open" ? "clock" : "alert"}>
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
