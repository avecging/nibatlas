import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { MapFilters } from "@/src/components/map/MapFilters";
import { EMPTY_FILTERS, type ShopFilters } from "@/src/domain/filters";

function filters(overrides: Partial<ShopFilters> = {}): ShopFilters {
  return { ...EMPTY_FILTERS, ...overrides };
}

function renderFilters(overrides: Partial<Parameters<typeof MapFilters>[0]> = {}) {
  const handlers = {
    onOpen: vi.fn(),
    onClose: vi.fn(),
    onStatusChange: vi.fn(),
    onDraftAvailabilityChange: vi.fn(),
    onToggleDraftType: vi.fn(),
    onClearDraft: vi.fn(),
    onApply: vi.fn(),
    onClear: vi.fn(),
  };

  const view = render(
    <MapFilters
      filters={EMPTY_FILTERS}
      draftFilters={EMPTY_FILTERS}
      open={false}
      hasUnapplied={false}
      draftMatchCount={6}
      appliesCamera={false}
      {...handlers}
      {...overrides}
    />,
  );

  return { ...handlers, view };
}

describe("MapFilters", () => {
  /*
   * The staging finding was about presentation on a card, not about which
   * filters exist. All four visit choices stay.
   */
  it("offers all four visit choices as a segment", () => {
    renderFilters();

    const segment = screen.getByRole("group", { name: "Visit status" });

    expect(
      within(segment)
        .getAllByRole("button")
        .map((button) => button.textContent),
    ).toEqual(["All", "Unvisited", "Saved", "Visited"]);
  });

  it("commits the visit segment on press", () => {
    const { onStatusChange } = renderFilters();

    fireEvent.click(screen.getByRole("button", { name: "Unvisited" }));

    expect(onStatusChange).toHaveBeenCalledWith("unvisited");
  });

  it("keeps shop type and availability behind one labelled button", () => {
    renderFilters();

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Fountain Pen Specialist" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Recorded as open" }),
    ).not.toBeInTheDocument();
  });

  it("opens the drawer and reports it to the caller", () => {
    const { onOpen } = renderFilters();
    const trigger = screen.getByRole("button", { name: /filters/i });

    expect(trigger).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(trigger);

    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("shows shop type and availability inside the drawer", () => {
    renderFilters({ open: true });

    const drawer = screen.getByRole("dialog", { name: "Filters" });

    expect(within(drawer).getByRole("group", { name: "Shop type" })).toBeInTheDocument();
    expect(
      within(drawer).getByRole("button", { name: "Fountain Pen Specialist" }),
    ).toBeInTheDocument();
    expect(
      within(drawer).getByRole("button", { name: "Recorded as open" }),
    ).toBeInTheDocument();
  });

  /*
   * Availability filters the status a record carries. Nothing here may read as
   * "Open now".
   */
  it("names availability as a recorded status and never as open now", () => {
    renderFilters({ open: true });

    const drawer = screen.getByRole("dialog", { name: "Filters" });

    for (const label of ["Any recorded status", "Recorded as open", "Hide recorded closures"]) {
      expect(within(drawer).getByRole("button", { name: label })).toBeInTheDocument();
    }

    expect(within(drawer).queryByText(/open now/i)).not.toBeInTheDocument();
    expect(
      within(drawer).getByText(/not live opening hours/i),
    ).toBeInTheDocument();
  });

  it("edits the draft rather than the applied filters", () => {
    const { onToggleDraftType, onDraftAvailabilityChange } = renderFilters({ open: true });

    fireEvent.click(screen.getByRole("button", { name: "Vintage / Used" }));
    fireEvent.click(screen.getByRole("button", { name: "Hide recorded closures" }));

    expect(onToggleDraftType).toHaveBeenCalledWith("vintage_used");
    expect(onDraftAvailabilityChange).toHaveBeenCalledWith("not_closed");
  });

  it("draws the drawer controls from the draft, not from what is applied", () => {
    renderFilters({
      open: true,
      filters: EMPTY_FILTERS,
      draftFilters: filters({ shopTypes: ["vintage_used"], availability: "open" }),
    });

    expect(screen.getByRole("button", { name: "Vintage / Used" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "Recorded as open" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("commits every drawer dimension in one action", () => {
    const { onApply } = renderFilters({
      open: true,
      hasUnapplied: true,
      draftFilters: filters({ shopTypes: ["vintage_used"], availability: "open" }),
    });

    fireEvent.click(screen.getByRole("button", { name: "Apply filters" }));

    expect(onApply).toHaveBeenCalledTimes(1);
  });

  it("says when applying will also commit the camera the reader moved to", () => {
    renderFilters({ open: true, appliesCamera: true });

    expect(
      screen.getByRole("button", { name: "Apply and search this area" }),
    ).toBeInTheDocument();
  });

  it("clears the draft controls without applying them", () => {
    const { onClearDraft, onApply } = renderFilters({
      open: true,
      draftFilters: filters({ shopTypes: ["vintage_used"] }),
    });

    fireEvent.click(screen.getByRole("button", { name: /^clear$/i }));

    expect(onClearDraft).toHaveBeenCalledTimes(1);
    expect(onApply).not.toHaveBeenCalled();
  });

  /*
   * The drawer's Clear is for the drawer's own controls: a visit choice made
   * outside it is not something it offers to clear.
   */
  it("does not offer the drawer clear for a visit filter it does not hold", () => {
    renderFilters({
      open: true,
      filters: filters({ status: "saved" }),
      draftFilters: filters({ status: "saved" }),
    });

    expect(screen.getByRole("button", { name: /^clear$/i })).toBeDisabled();
  });

  /*
   * The badge counts what is applied. It describes the results on screen, and
   * the visit segment is not counted there because it is already visible.
   */
  it("badges the applied drawer criteria only", () => {
    renderFilters({
      filters: filters({
        status: "saved",
        shopTypes: ["vintage_used", "stationery_store"],
        availability: "open",
      }),
      draftFilters: EMPTY_FILTERS,
    });

    expect(screen.getByTestId("filter-count")).toHaveTextContent("3");
  });

  it("carries no badge for an unapplied draft", () => {
    renderFilters({
      filters: EMPTY_FILTERS,
      draftFilters: filters({ shopTypes: ["vintage_used"] }),
    });

    expect(screen.queryByTestId("filter-count")).not.toBeInTheDocument();
  });

  it("clears every applied filter in one action", () => {
    const { onClear } = renderFilters({
      filters: filters({ status: "saved", shopTypes: ["vintage_used"], availability: "open" }),
    });

    fireEvent.click(screen.getByRole("button", { name: /clear filters/i }));

    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it("offers no clear when nothing is applied", () => {
    renderFilters();

    expect(
      screen.queryByRole("button", { name: /clear filters/i }),
    ).not.toBeInTheDocument();
  });

  it("offers the clear for a visit filter the drawer does not hold", () => {
    renderFilters({ filters: filters({ status: "unvisited" }) });

    expect(screen.getByRole("button", { name: /clear filters/i })).toBeInTheDocument();
  });

  it("reports the live number of draft matches when it can be counted", () => {
    renderFilters({ open: true, draftMatchCount: 1 });

    expect(screen.getByText("1 shop match")).toBeInTheDocument();
  });

  /* A count the loaded set cannot answer exactly is not guessed at. */
  it("says nothing rather than guessing when the draft cannot be counted", () => {
    renderFilters({ open: true, draftMatchCount: null });

    expect(screen.getByText("Apply to see what matches.")).toBeInTheDocument();
    expect(screen.queryByText(/shops? match/)).not.toBeInTheDocument();
  });

  it("discards the draft on Escape and on the scrim", () => {
    const { onClose, onApply, view } = renderFilters({ open: true, hasUnapplied: true });

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.click(view.getByTestId("filter-scrim"));
    expect(onClose).toHaveBeenCalledTimes(2);
    expect(onApply).not.toHaveBeenCalled();
  });

  /*
   * `aria-modal` does not make the rest of the page inert, so the drawer uses
   * the same modal focus contract every other dialog here does.
   */
  it("moves focus into the drawer when it opens and traps it there", () => {
    const { view } = renderFilters();

    view.rerender(
      <MapFilters
        filters={EMPTY_FILTERS}
        draftFilters={EMPTY_FILTERS}
        open
        hasUnapplied={false}
        draftMatchCount={6}
        appliesCamera={false}
        onOpen={() => {}}
        onClose={() => {}}
        onStatusChange={() => {}}
        onDraftAvailabilityChange={() => {}}
        onToggleDraftType={() => {}}
        onClearDraft={() => {}}
        onApply={() => {}}
        onClear={() => {}}
      />,
    );

    const drawer = screen.getByRole("dialog", { name: "Filters" });

    expect(document.activeElement).toBe(drawer);

    const focusable = [...drawer.querySelectorAll<HTMLElement>("button")];
    const first = focusable[0]!;
    const last = focusable[focusable.length - 1]!;

    // Tab from the dialog itself lands on its first control, not behind it.
    fireEvent.keyDown(document, { key: "Tab" });
    expect(document.activeElement).toBe(first);

    // And the ends wrap rather than walking out past the scrim.
    last.focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(document.activeElement).toBe(first);

    first.focus();
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(last);
  });
});
