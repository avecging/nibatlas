import type { ReactNode } from "react";

import { Icon, type IconName } from "@/src/components/ui/Icon";
import type { MarkerState, OperationalStatus } from "@/src/domain/shops";
import { OPERATIONAL_STATUS_LABELS } from "@/src/domain/shop-detail";

import styles from "./StatusBadge.module.css";

type Tone = "visited" | "saved" | "unvisited" | "neutral" | "warning" | "demo";

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
  const tone: Tone =
    status === "open" ? "neutral" : status === "unknown" ? "neutral" : "warning";

  return (
    <Badge tone={tone} icon={status === "open" ? "clock" : "alert"}>
      {OPERATIONAL_STATUS_LABELS[status]}
    </Badge>
  );
}

export function DemoBadge({ children = "Demo data" }: { readonly children?: ReactNode }) {
  return <Badge tone="demo">{children}</Badge>;
}
