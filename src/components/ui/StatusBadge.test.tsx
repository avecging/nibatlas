import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  MarkerStateBadge,
  OPERATIONAL_STATUS_TONE,
  OperationalStatusBadge,
} from "@/src/components/ui/StatusBadge";
import type { OperationalStatus } from "@/src/domain/shops";

/**
 * The operational-status hierarchy, after the founder's second staging review.
 *
 * Three levels, not two: a confirmed closure is the loudest, `Open` is a
 * positive fact worth seeing, and an unconfirmed status is present but quieter
 * than a real closure. The badge is shared with the map and results cards, so
 * these assertions are about the component every surface renders.
 */
function renderStatus(status: OperationalStatus) {
  const { container } = render(<OperationalStatusBadge status={status} />);
  const badge = container.querySelector("span");

  if (badge === null) {
    throw new Error("no badge rendered");
  }

  return badge;
}

describe("operational status", () => {
  it("gives Open the success treatment, with its own non-colour cue", () => {
    const badge = renderStatus("open");

    expect(badge).toHaveTextContent("Open");
    expect(OPERATIONAL_STATUS_TONE.open).toBe("success");
    expect(badge.querySelector("svg")).toBeInTheDocument();
  });

  it("keeps both closed states on the strongest treatment", () => {
    for (const status of ["temporarily_closed", "permanently_closed"] as const) {
      renderStatus(status);
      expect(OPERATIONAL_STATUS_TONE[status]).toBe("warning");
    }

    // Wording and meaning are unchanged by the hierarchy work.
    expect(screen.getAllByText("Temporarily closed")).toHaveLength(1);
    expect(screen.getAllByText("Permanently closed")).toHaveLength(1);
  });

  it("steps an unconfirmed status back below a real closure", () => {
    const badge = renderStatus("unknown");

    // Still said out loud, still carrying the alert icon — but not the filled
    // amber a confirmed closure gets.
    expect(badge).toHaveTextContent("Status not confirmed");
    expect(OPERATIONAL_STATUS_TONE.unknown).toBe("caution");
    expect(OPERATIONAL_STATUS_TONE.unknown).not.toBe(
      OPERATIONAL_STATUS_TONE.temporarily_closed,
    );
    expect(badge.querySelector("svg")).toBeInTheDocument();
  });

  it("never leaves a status to colour alone", () => {
    for (const status of [
      "open",
      "temporarily_closed",
      "permanently_closed",
      "unknown",
    ] as const) {
      const badge = renderStatus(status);

      expect(badge.textContent?.trim().length ?? 0).toBeGreaterThan(0);
      expect(badge.querySelector("svg")).toBeInTheDocument();
    }
  });
});

describe("marker state", () => {
  it("is a separate dimension, and this change did not reach into it", () => {
    render(
      <>
        <MarkerStateBadge state="visited" />
        <MarkerStateBadge state="saved" />
        <MarkerStateBadge state="unvisited" />
      </>,
    );

    // Saved keeps Teal and its bookmark, visited keeps Vermilion and its seal:
    // what the reader owns is untouched by the operational-status hierarchy.
    // (Their overlap on the map card is a WP6 finding, recorded not fixed here.)
    expect(screen.getByText("Visited")).toBeInTheDocument();
    expect(screen.getByText("Saved")).toBeInTheDocument();
    expect(screen.getByText("Not visited")).toBeInTheDocument();
  });
});
