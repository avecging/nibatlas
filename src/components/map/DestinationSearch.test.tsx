import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DestinationSearch } from "@/src/components/map/DestinationSearch";
import type {
  DestinationGeocoder,
  SearchResults,
} from "@/src/features/map/destination-geocoder";

const PLACE = {
  id: "ginza",
  name: "Ginza",
  context: "Chuo, Tokyo",
  viewport: { bounds: { west: 139.7, south: 35.6, east: 139.8, north: 35.7 }, zoom: 14 },
};

const PLACED_SHOP = {
  id: "shop-1",
  slug: "ginza-itoya",
  name: "Ginza Itoya Main Store",
  localityName: "Tokyo",
  countryCode: "JP" as const,
  target: {
    shop: {
      id: "shop-1",
      slug: "ginza-itoya",
      name: "Ginza Itoya Main Store",
      countryCode: "JP" as const,
      localityName: "Tokyo",
      position: { latitude: 35.67, longitude: 139.76 },
      primaryType: "stationery_store" as const,
      specialtyLine: null,
      operationalStatus: "open" as const,
      markerState: "unvisited" as const,
      sourceQuality: "sourced" as const,
    },
    viewport: {
      bounds: { west: 139.75, south: 35.66, east: 139.77, north: 35.68 },
      zoom: 16,
    },
  },
};

const UNPLACED_SHOP = {
  id: "shop-2",
  slug: "kobe-nagasawa",
  name: "Nagasawa Bunbougu Center",
  localityName: "Kobe",
  countryCode: "JP" as const,
  matchedAlias: "ナガサワ文具センター",
};

function geocoderOf(
  results: SearchResults | (() => Promise<SearchResults>),
): DestinationGeocoder {
  return {
    search: typeof results === "function" ? results : async () => results,
  };
}

function renderSearch(
  geocoder: DestinationGeocoder,
  overrides: Partial<Parameters<typeof DestinationSearch>[0]> = {},
) {
  const handlers = {
    onChooseDestination: vi.fn(),
    onChooseShop: vi.fn(),
    onChooseShopSlug: vi.fn(),
  };

  render(<DestinationSearch geocoder={geocoder} {...handlers} {...overrides} />);

  return handlers;
}

async function search(query: string) {
  fireEvent.change(screen.getByRole("combobox", { name: /search shops or places/i }), {
    target: { value: query },
  });

  await act(async () => {
    await vi.advanceTimersByTimeAsync(200);
  });
}

describe("destination search", () => {
  it("labels places and canonical shops as separate groups", async () => {
    vi.useFakeTimers();

    try {
      renderSearch(geocoderOf({ destinations: [PLACE], shops: [PLACED_SHOP] }));
      await search("Ginza");

      const listbox = screen.getByRole("listbox", { name: /search results/i });

      expect(within(listbox).getByText("Places")).toBeInTheDocument();
      expect(within(listbox).getByText("Shops")).toBeInTheDocument();
      expect(screen.getByText(/^Place · /)).toBeInTheDocument();
      expect(
        screen.getByText(/Shop in the Nib Atlas catalogue/),
      ).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  /*
   * A listbox may contain options and groups, and nothing else. The panel was
   * previously `li` elements inside a `role="listbox"` list, which made the two
   * group headings read as choosable results and failed WCAG 1.3.1 twice.
   */
  it("exposes the groups as named groups of options, and nothing else", async () => {
    vi.useFakeTimers();

    try {
      renderSearch(geocoderOf({ destinations: [PLACE], shops: [PLACED_SHOP] }));
      await search("Ginza");

      const listbox = screen.getByRole("listbox", { name: /search results/i });

      expect(within(listbox).getByRole("group", { name: "Places" })).toBeInTheDocument();
      expect(within(listbox).getByRole("group", { name: "Shops" })).toBeInTheDocument();
      expect(within(listbox).queryAllByRole("listitem")).toHaveLength(0);
      expect(within(listbox).getAllByRole("option")).toHaveLength(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps the empty and failed messages outside the listbox", async () => {
    vi.useFakeTimers();

    try {
      renderSearch(geocoderOf({ destinations: [], shops: [] }));
      await search("nothing");

      const listbox = screen.getByRole("listbox", { name: /search results/i });

      expect(within(listbox).queryAllByRole("option")).toHaveLength(0);
      expect(
        within(listbox).queryByText(/No places or catalogue shops match/),
      ).not.toBeInTheDocument();
      expect(screen.getByText(/No places or catalogue shops match/)).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("moves the map itself for a shop the supplier already placed", async () => {
    vi.useFakeTimers();

    try {
      const handlers = renderSearch(
        geocoderOf({ destinations: [], shops: [PLACED_SHOP] }),
      );
      await search("Itoya");

      fireEvent.click(screen.getByRole("option", { name: /Ginza Itoya/ }));

      expect(handlers.onChooseShop).toHaveBeenCalledWith(
        PLACED_SHOP.target.shop,
        PLACED_SHOP.target.viewport,
      );
      expect(handlers.onChooseShopSlug).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  /*
   * `GET /api/v1/shops/search` returns canonical records without coordinates, so
   * the panel asks the caller to resolve the position rather than guessing one.
   */
  it("asks the caller to resolve a canonical hit that carries no position", async () => {
    vi.useFakeTimers();

    try {
      const handlers = renderSearch(
        geocoderOf({ destinations: [], shops: [UNPLACED_SHOP] }),
      );
      await search("Nagasawa");

      expect(screen.getByText(/matched “ナガサワ文具センター”/)).toBeInTheDocument();

      fireEvent.click(screen.getByRole("option", { name: /Nagasawa/ }));

      expect(handlers.onChooseShopSlug).toHaveBeenCalledWith("kobe-nagasawa");
      expect(handlers.onChooseShop).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("says a search failed rather than showing the last query's results", async () => {
    vi.useFakeTimers();

    try {
      renderSearch(
        geocoderOf(async () => {
          throw new Error("upstream failed");
        }),
      );
      await search("Kobe");

      expect(screen.getByText(/Search is unavailable right now/)).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("cancels an in-flight search when the query moves on", async () => {
    vi.useFakeTimers();

    try {
      const signals: (AbortSignal | undefined)[] = [];
      const geocoder: DestinationGeocoder = {
        search: vi.fn(async (_query: string, signal?: AbortSignal) => {
          signals.push(signal);
          return { destinations: [PLACE], shops: [] };
        }),
      };

      renderSearch(geocoder);
      await search("Gin");
      await search("Ginza");

      expect(signals).toHaveLength(2);
      expect(signals[0]?.aborted).toBe(true);
      expect(signals[1]?.aborted).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it("tells the reader when a chosen shop is still being placed", async () => {
    renderSearch(geocoderOf({ destinations: [], shops: [] }), {
      locatingSlug: "kobe-nagasawa",
    });

    await waitFor(() =>
      expect(screen.getByText(/Locating that shop on the map/)).toBeInTheDocument(),
    );
  });
});
