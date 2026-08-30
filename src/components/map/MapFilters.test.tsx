import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { MapFilters } from "@/src/components/map/MapFilters";
import { EMPTY_FILTERS } from "@/src/domain/filters";

function renderFilters(overrides: Partial<Parameters<typeof MapFilters>[0]> = {}) {
  const handlers = {
    onOpenChange: vi.fn(),
    onStatusChange: vi.fn(),
    onAvailabilityChange: vi.fn(),
    onToggleType: vi.fn(),
    onClear: vi.fn(),
  };

  const view = render(
    <MapFilters
      filters={EMPTY_FILTERS}
      open={false}
      resultCount={6}
      {...handlers}
      {...overrides}
    />,
  );

  return { ...handlers, view };
}

describe("MapFilters", () => {
  it("offers a three-way visit segment with no Unvisited position", () => {
    renderFilters();

    const segment = screen.getByRole("group", { name: "Visit status" });

    expect(
      within(segment)
        .getAllByRole("button")
        .map((button) => button.textContent),
    ).toEqual(["All", "Saved", "Visited"]);
    expect(screen.queryByRole("button", { name: "Unvisited" })).not.toBeInTheDocument();
  });

  it("changes the visit segment on press", () => {
    const { onStatusChange } = renderFilters();

    fireEvent.click(screen.getByRole("button", { name: "Visited" }));

    expect(onStatusChange).toHaveBeenCalledWith("visited");
  });

  it("keeps shop type and availability behind one labelled button", () => {
    renderFilters();

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Fountain Pen Specialist" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Confirmed open" })).not.toBeInTheDocument();
  });

  it("opens the drawer and reports it to the caller", () => {
    const { onOpenChange } = renderFilters();
    const trigger = screen.getByRole("button", { name: /filters/i });

    expect(trigger).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(trigger);

    expect(onOpenChange).toHaveBeenCalledWith(true);
  });

  it("shows shop type and availability inside the drawer", () => {
    renderFilters({ open: true });

    const drawer = screen.getByRole("dialog", { name: "Filters" });

    expect(
      within(drawer).getByRole("group", { name: "Shop type" }),
    ).toBeInTheDocument();
    expect(
      within(drawer).getByRole("button", { name: "Fountain Pen Specialist" }),
    ).toBeInTheDocument();
    expect(
      within(drawer).getByRole("button", { name: "Confirmed open" }),
    ).toBeInTheDocument();
  });

  it("toggles a shop type and an availability from the drawer", () => {
    const { onToggleType, onAvailabilityChange } = renderFilters({ open: true });

    fireEvent.click(screen.getByRole("button", { name: "Vintage / Used" }));
    fireEvent.click(screen.getByRole("button", { name: "Hide closed" }));

    expect(onToggleType).toHaveBeenCalledWith("vintage_used");
    expect(onAvailabilityChange).toHaveBeenCalledWith("not_closed");
  });

  /*
   * The badge counts only what the drawer hides. The visit segment is on screen,
   * so counting it would label a choice the reader can already see.
   */
  it("badges the count of criteria set behind the button", () => {
    renderFilters({
      filters: {
        status: "saved",
        shopTypes: ["vintage_used", "stationery_store"],
        availability: "open",
      },
    });

    expect(screen.getByTestId("filter-count")).toHaveTextContent("3");
  });

  it("carries no badge when nothing is set behind the button", () => {
    renderFilters({ filters: { ...EMPTY_FILTERS, status: "saved" } });

    expect(screen.queryByTestId("filter-count")).not.toBeInTheDocument();
  });

  it("clears every filter in one action", () => {
    const { onClear } = renderFilters({
      filters: { status: "saved", shopTypes: ["vintage_used"], availability: "open" },
    });

    fireEvent.click(screen.getByRole("button", { name: /clear filters/i }));

    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it("offers no clear when nothing is set", () => {
    renderFilters();

    expect(screen.queryByRole("button", { name: /clear filters/i })).not.toBeInTheDocument();
  });

  /*
   * A visit-segment choice is a filter too, so it must be clearable without
   * opening a drawer that holds nothing.
   */
  it("offers the clear for a visit filter the drawer does not hold", () => {
    renderFilters({ filters: { ...EMPTY_FILTERS, status: "visited" } });

    expect(screen.getByRole("button", { name: /clear filters/i })).toBeInTheDocument();
  });

  it("reports the live number of matching shops while the drawer is open", () => {
    renderFilters({ open: true, resultCount: 1 });

    expect(screen.getByText("1 shop match")).toBeInTheDocument();
  });

  it("closes on Escape and on the scrim", () => {
    const { onOpenChange, view } = renderFilters({ open: true });

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onOpenChange).toHaveBeenCalledWith(false);

    onOpenChange.mockClear();
    fireEvent.click(view.getByTestId("filter-scrim"));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("moves focus into the drawer when it opens", () => {
    const { view } = renderFilters();

    view.rerender(
      <MapFilters
        filters={EMPTY_FILTERS}
        open
        resultCount={6}
        onOpenChange={() => {}}
        onStatusChange={() => {}}
        onAvailabilityChange={() => {}}
        onToggleType={() => {}}
        onClear={() => {}}
      />,
    );

    expect(document.activeElement).toBe(screen.getByRole("dialog", { name: "Filters" }));
  });
});
