import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ShopList } from "@/src/components/shops/ShopList";
import { prototypeShopSummaries } from "@/src/fixtures/prototype-catalogue";

const shops = prototypeShopSummaries.slice(0, 3);
const first = shops[0]!;
const second = shops[1]!;

/** Whether the environment reports a hoverable, fine pointer. */
function setPointer({ fine }: { readonly fine: boolean }) {
  vi.stubGlobal(
    "matchMedia",
    (query: string) =>
      ({
        matches: query.includes("hover") ? fine : false,
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {},
      }) as unknown as MediaQueryList,
  );
}

function renderList(overrides: Partial<Parameters<typeof ShopList>[0]> = {}) {
  const onHighlight = vi.fn();
  const onToggleSaved = vi.fn();

  render(
    <ShopList
      shops={shops}
      selectedShopId={null}
      savedShopIds={new Set()}
      truncated={false}
      onHighlight={onHighlight}
      onToggleSaved={onToggleSaved}
      {...overrides}
    />,
  );

  return { onHighlight, onToggleSaved };
}

describe("ShopList", () => {
  beforeEach(() => {
    setPointer({ fine: true });
  });

  it("renders one accessible row per map result", () => {
    renderList();

    const list = screen.getByRole("list", { name: /shops in the searched area/i });
    expect(within(list).getAllByRole("listitem")).toHaveLength(shops.length);
  });

  it("opens the shop from the body of the card", () => {
    renderList();

    expect(screen.getByRole("link", { name: first.name })).toHaveAttribute(
      "href",
      `/shops/${first.slug}?from=map`,
    );
  });

  it("carries the surface through so the shop page can offer the way back", () => {
    renderList({ detailFrom: "saved" });

    expect(screen.getByRole("link", { name: first.name })).toHaveAttribute(
      "href",
      `/shops/${first.slug}?from=saved`,
    );
  });

  it("highlights the marker on hover where a real pointer can hover", () => {
    const { onHighlight } = renderList();
    const card = screen.getByRole("article", { name: first.name });

    fireEvent.mouseEnter(card);
    expect(onHighlight).toHaveBeenCalledWith(first.id);

    fireEvent.mouseLeave(card);
    expect(onHighlight).toHaveBeenLastCalledWith(null);
  });

  it("does not highlight on hover where the pointer is coarse", () => {
    setPointer({ fine: false });
    const { onHighlight } = renderList();

    fireEvent.mouseEnter(screen.getByRole("article", { name: first.name }));

    expect(onHighlight).not.toHaveBeenCalled();
  });

  it("gives keyboard focus the same highlight a hover gives", () => {
    setPointer({ fine: false });
    const { onHighlight } = renderList();

    screen.getByRole("link", { name: first.name }).focus();

    expect(onHighlight).toHaveBeenCalledWith(first.id);
  });

  it("marks the selected and the highlighted card apart", () => {
    renderList({ selectedShopId: second.id, highlightedShopId: first.id });

    expect(screen.getByRole("article", { name: second.name })).toHaveAttribute(
      "data-selected",
      "true",
    );
    expect(screen.getByRole("article", { name: second.name })).toHaveAttribute(
      "data-highlighted",
      "false",
    );
    expect(screen.getByRole("article", { name: first.name })).toHaveAttribute(
      "data-highlighted",
      "true",
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

  /*
   * Visited and saved are separate states, and "not visited" is the absence of
   * one rather than a third pill.
   */
  it("shows visited and saved as separate facts, and neither when neither applies", () => {
    renderList({
      savedShopIds: new Set([first.id]),
      visitedShopIds: new Set([first.id]),
    });

    const card = screen.getByRole("article", { name: first.name });

    // Visited is its own badge; saved is carried by its own labelled control.
    expect(within(card).getByText("Visited")).toBeInTheDocument();
    expect(within(card).getByRole("button", { name: /^saved$/i })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    const plain = screen.getByRole("article", { name: second.name });
    expect(within(plain).queryByText(/not visited/i)).not.toBeInTheDocument();
    expect(within(plain).queryByText("Visited")).not.toBeInTheDocument();
    expect(within(plain).getByRole("button", { name: /^save$/i })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("toggles saving from the card without opening the shop", () => {
    const { onToggleSaved } = renderList();
    const card = screen.getByRole("article", { name: first.name });
    const save = within(card).getByRole("button", { name: /^save$/i });

    fireEvent.click(save);

    expect(onToggleSaved).toHaveBeenCalledWith(first.id);
    // The Save control is its own action; it is never inside the card-wide link.
    expect(save.closest("a")).toBeNull();
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
