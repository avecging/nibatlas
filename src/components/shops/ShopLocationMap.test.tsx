import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ShopLocationMap } from "./ShopLocationMap";
import type { ShopDetail } from "@/src/domain/shop-detail";
import { findPrototypeShop } from "@/src/fixtures/prototype-catalogue";

/**
 * The location preview.
 *
 * What is under test is the promise the section makes to a reader: the picture
 * is centred on the coordinate the record actually holds, it cannot take a page
 * scroll, a record with no usable coordinate gets no invented one, and nothing
 * the renderer does can take the way out to a real map with it.
 */
const mock = vi.hoisted(() => ({
  construct: vi.fn(),
  remove: vi.fn(),
  addTo: vi.fn(),
  setWorkerUrl: vi.fn(),
}));

vi.mock("maplibre-gl", () => ({
  Map: class {
    constructor(options: unknown) {
      return mock.construct(options);
    }
  },
  Marker: class {
    setLngLat() {
      return this;
    }
    addTo(map: unknown) {
      return mock.addTo(map);
    }
  },
  NavigationControl: class {},
  setWorkerUrl: mock.setWorkerUrl,
}));

const itoya = findPrototypeShop("ginza-itoya-main-store")!;

/*
 * Every case below is a keyed deployment unless it says otherwise: without a
 * tile key there is no geography to draw at this zoom, and the preview is
 * omitted rather than framed around a blank sheet.
 */
beforeEach(() => vi.stubEnv("NEXT_PUBLIC_MAPTILER_KEY", "test-tile-key"));

function instance() {
  return { on: vi.fn(), remove: mock.remove };
}

beforeEach(() => {
  mock.construct.mockReset();
  mock.remove.mockReset();
  mock.addTo.mockReset();
  mock.construct.mockImplementation(() => instance());
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("the location preview", () => {
  it("frames the coordinate the record holds, and takes no gestures", async () => {
    render(<ShopLocationMap shop={itoya} />);

    await waitFor(() => expect(mock.construct).toHaveBeenCalledOnce());

    const options = mock.construct.mock.calls[0]![0] as {
      center: [number, number];
      zoom: number;
      interactive: boolean;
    };

    expect(options.center).toEqual([itoya.position.longitude, itoya.position.latitude]);
    expect(options.zoom).toBe(15);
    // Every handler off, so a preview on a phone cannot swallow a page scroll.
    expect(options.interactive).toBe(false);
    expect(mock.addTo).toHaveBeenCalledOnce();
  });

  it("draws a locality-only record as an area, not an address", async () => {
    const approximate = findPrototypeShop("nagasawa-stationery-center-main-store")!;

    expect(approximate.positionPrecision).toBe("locality");
    render(<ShopLocationMap shop={approximate} />);

    await waitFor(() => expect(mock.construct).toHaveBeenCalledOnce());
    expect((mock.construct.mock.calls[0]![0] as { zoom: number }).zoom).toBe(11);
  });

  it("omits the preview rather than framing a build with no basemap", () => {
    vi.stubEnv("NEXT_PUBLIC_MAPTILER_KEY", "");

    render(<ShopLocationMap shop={itoya} />);

    expect(screen.queryByTestId("shop-location-map")).not.toBeInTheDocument();
    expect(mock.construct).not.toHaveBeenCalled();
  });

  it("invents no location for a record whose coordinate is unusable", () => {
    const unplaced: ShopDetail = {
      ...itoya,
      position: { latitude: 0, longitude: 0 },
    };

    render(<ShopLocationMap shop={unplaced} />);

    expect(screen.queryByTestId("shop-location-map")).not.toBeInTheDocument();
    expect(mock.construct).not.toHaveBeenCalled();
  });

  it("keeps the way out to a real map when the renderer will not start", async () => {
    mock.construct.mockImplementation(() => {
      throw new Error("No WebGL");
    });

    render(<ShopLocationMap shop={itoya} />);

    expect(await screen.findByText("Map preview unavailable.")).toBeVisible();

    const directions = screen.getByRole("link", { name: /get directions/i });

    // The desktop snapshot: OpenStreetMap, carrying only the destination.
    expect(directions).toHaveAttribute(
      "href",
      `https://www.openstreetmap.org/directions?to=${encodeURIComponent(
        `${itoya.position.latitude},${itoya.position.longitude}`,
      )}`,
    );
  });

  it("offers directions whether or not the picture ever arrives", async () => {
    render(<ShopLocationMap shop={itoya} />);

    expect(screen.getByRole("link", { name: /get directions/i })).toBeVisible();
    await waitFor(() => expect(mock.construct).toHaveBeenCalledOnce());
    expect(screen.getByRole("link", { name: /get directions/i })).toBeVisible();
  });

  it("tears the renderer down when the reader leaves the page", async () => {
    const view = render(<ShopLocationMap shop={itoya} />);

    await waitFor(() => expect(mock.construct).toHaveBeenCalledOnce());
    view.unmount();

    expect(mock.remove).toHaveBeenCalledOnce();
  });
});
