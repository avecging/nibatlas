import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ShopList } from "@/src/components/shops/ShopList";
import { prototypeShopSummaries } from "@/src/fixtures/prototype-catalogue";

const shops = prototypeShopSummaries.slice(0, 3);
const first = shops[0]!;
const second = shops[1]!;

function renderList(overrides: Partial<Parameters<typeof ShopList>[0]> = {}) {
  const onSelect = vi.fn();
  const onToggleSaved = vi.fn();

  render(
    <ShopList
      shops={shops}
      selectedShopId={null}
      savedShopIds={new Set()}
      truncated={false}
      onSelect={onSelect}
      onToggleSaved={onToggleSaved}
      {...overrides}
    />,
  );

  return { onSelect, onToggleSaved };
}

describe("ShopList", () => {
  it("renders one accessible row per map result", () => {
    renderList();

    const list = screen.getByRole("list", { name: /shops in the searched area/i });
    expect(within(list).getAllByRole("listitem")).toHaveLength(shops.length);
  });

  it("reports selection back to the shared state", () => {
    const { onSelect } = renderList();

    fireEvent.click(screen.getByRole("button", { name: first.name }));

    expect(onSelect).toHaveBeenCalledWith(first.id);
  });

  it("marks only the selected card as selected", () => {
    renderList({ selectedShopId: second.id });

    expect(screen.getByRole("button", { name: second.name })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: first.name })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("shows saved state with text as well as colour", () => {
    renderList({ savedShopIds: new Set([first.id]) });

    const card = screen.getByRole("article", { name: first.name });
    expect(within(card).getByRole("button", { name: /^saved$/i })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("toggles saving from the card", () => {
    const { onToggleSaved } = renderList();
    const card = screen.getByRole("article", { name: first.name });

    fireEvent.click(within(card).getByRole("button", { name: /^save$/i }));

    expect(onToggleSaved).toHaveBeenCalledWith(first.id);
  });

  it("explains a truncated result set", () => {
    renderList({ truncated: true });

    expect(screen.getByText(/showing the first/i)).toBeInTheDocument();
  });

  it("explains an empty result set", () => {
    renderList({ shops: [] });

    expect(screen.getByText(/no shops match this area/i)).toBeInTheDocument();
  });
});
