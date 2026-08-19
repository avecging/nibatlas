import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { FilterBar } from "@/src/components/map/FilterBar";
import { EMPTY_FILTERS } from "@/src/domain/filters";

function renderBar(overrides: Partial<Parameters<typeof FilterBar>[0]> = {}) {
  const onStatusChange = vi.fn();
  const onToggleType = vi.fn();
  const onClear = vi.fn();

  render(
    <FilterBar
      filters={EMPTY_FILTERS}
      uncommitted={false}
      onStatusChange={onStatusChange}
      onToggleType={onToggleType}
      onClear={onClear}
      {...overrides}
    />,
  );

  return { onStatusChange, onToggleType, onClear };
}

describe("FilterBar", () => {
  it("offers the four status filters and the four shop types", () => {
    renderBar();

    for (const label of ["All", "Unvisited", "Visited", "Saved"]) {
      expect(screen.getByRole("button", { name: label })).toBeInTheDocument();
    }

    for (const label of [
      "Fountain Pen Specialist",
      "Stationery Store",
      "Vintage / Used",
      "Nib / Repair Services",
    ]) {
      expect(screen.getByRole("button", { name: label })).toBeInTheDocument();
    }
  });

  it("reports the active filter count", () => {
    renderBar({ filters: { status: "saved", shopTypes: ["vintage_used"] } });

    expect(screen.getByText("2 filters active")).toBeInTheDocument();
  });

  it("says filters apply only on the next committed search", () => {
    renderBar({ filters: { status: "visited", shopTypes: [] }, uncommitted: true });

    expect(screen.getByText(/search this area to apply/i)).toBeInTheDocument();
  });

  it("changes status and toggles a shop type", () => {
    const { onStatusChange, onToggleType } = renderBar();

    fireEvent.click(screen.getByRole("button", { name: "Visited" }));
    fireEvent.click(screen.getByRole("button", { name: "Vintage / Used" }));

    expect(onStatusChange).toHaveBeenCalledWith("visited");
    expect(onToggleType).toHaveBeenCalledWith("vintage_used");
  });

  it("clears every filter in one action", () => {
    const { onClear } = renderBar({
      filters: { status: "saved", shopTypes: ["vintage_used"] },
    });

    fireEvent.click(screen.getByRole("button", { name: /clear filters/i }));

    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it("disables clearing when nothing is active", () => {
    renderBar();

    expect(screen.getByRole("button", { name: /clear filters/i })).toBeDisabled();
  });
});
