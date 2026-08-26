import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import {
  CollectionProvider,
  localCollectionDate,
  useCollection,
} from "@/src/features/collection/collection-store";
import {
  findPrototypeShop,
  prototypeShopDetails,
} from "@/src/fixtures/prototype-catalogue";

function renderStore() {
  return renderHook(() => useCollection(), { wrapper: CollectionProvider });
}

/** Neither seeded as collected nor seeded as saved, so it starts clean. */
const unvisited = findPrototypeShop("juspirit-banqiao")!;

describe("collection store", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it("seeds saved and visited state from the prototype fixtures", () => {
    const { result } = renderStore();

    expect(result.current.savedShopIds.size).toBeGreaterThan(0);
    expect(result.current.passport.countryCount).toBe(3);
    expect(result.current.isSaved(unvisited.id)).toBe(false);
    expect(result.current.isVisited(unvisited.id)).toBe(false);
  });

  it("derives seals from the seeded collection", () => {
    const { result } = renderStore();

    // Singapore's curated set holds two shops and both are seeded, so its
    // country seal is earned by completing a set smaller than five.
    expect(result.current.countrySeal("SG")).toBeDefined();
    expect(result.current.countrySeal("JP")).toBeUndefined();
    expect(result.current.localitySeal("TW", "east-tainan")).toBeDefined();
  });

  it("keeps a seal earned in an earlier session", () => {
    const { result, unmount } = renderStore();

    expect(result.current.countrySeal("SG")).toBeDefined();
    unmount();

    // A fresh provider rehydrates from the same session storage.
    const second = renderStore();

    expect(second.result.current.countrySeal("SG")).toBeDefined();
  });

  it("toggles saving in both directions", () => {
    const { result } = renderStore();

    expect(result.current.isSaved(unvisited.id)).toBe(false);

    act(() => {
      result.current.toggleSaved(unvisited.id);
    });
    expect(result.current.isSaved(unvisited.id)).toBe(true);

    act(() => {
      result.current.toggleSaved(unvisited.id);
    });
    expect(result.current.isSaved(unvisited.id)).toBe(false);
  });

  it("issues exactly one impression per shop", () => {
    const { result } = renderStore();
    const before = result.current.passport.stampCount;

    act(() => {
      result.current.collectStamp(unvisited, new Date("2026-08-18T02:00:00Z"));
    });

    const afterFirst = result.current.passport.stampCount;
    expect(afterFirst).toBe(before + 1);
    expect(result.current.isVisited(unvisited.id)).toBe(true);

    act(() => {
      result.current.collectStamp(unvisited, new Date("2026-08-19T02:00:00Z"));
    });

    expect(result.current.passport.stampCount).toBe(afterFirst);
  });

  it("returns the existing impression when collecting twice", () => {
    const { result } = renderStore();

    let first = "";
    act(() => {
      first = result.current.collectStamp(unvisited, new Date("2026-08-18T02:00:00Z"))
        .collectedOn;
    });

    let second = "";
    act(() => {
      second = result.current.collectStamp(unvisited, new Date("2026-12-01T02:00:00Z"))
        .collectedOn;
    });

    expect(second).toBe(first);
  });

  it("puts a newly collected impression into the right Passport locality", () => {
    const { result } = renderStore();
    const shop = findPrototypeShop("ty-lee-pen-shop")!;

    act(() => {
      result.current.collectStamp(shop, new Date("2026-08-18T02:00:00Z"));
    });

    const taiwan = result.current.passport.countries.find(
      (country) => country.slug === "tw",
    );
    const locality = taiwan?.localities.find(
      (candidate) => candidate.name === "Da'an, Taipei",
    );

    expect(locality?.collections.some((item) => item.shopId === shop.id)).toBe(true);
  });

  it("derives a locality seal from a newly collected first visit", () => {
    const { result } = renderStore();
    const shop = findPrototypeShop("ty-lee-pen-shop")!;

    expect(result.current.localitySeal("TW", "daan-taipei")).toBeUndefined();

    act(() => {
      result.current.collectStamp(shop, new Date("2026-08-18T02:00:00Z"));
    });

    expect(result.current.localitySeal("TW", "daan-taipei")).toBeDefined();
  });

  it("restores the seeded prototype state on reset", () => {
    const { result } = renderStore();
    const seeded = result.current.passport.stampCount;

    act(() => {
      result.current.collectStamp(unvisited, new Date("2026-08-18T02:00:00Z"));
    });
    expect(result.current.passport.stampCount).toBe(seeded + 1);

    act(() => {
      result.current.resetPrototypeState();
    });
    expect(result.current.passport.stampCount).toBe(seeded);
  });
});

describe("prototype catalogue in the store", () => {
  it("exposes every prototype shop for the global Saved mode", () => {
    expect(prototypeShopDetails.length).toBeGreaterThan(0);
  });
});

describe("localCollectionDate", () => {
  it("uses the shop timezone snapshot, not the browser timezone", () => {
    // 2026-08-18T23:30Z is already 2026-08-19 in Tokyo and Singapore.
    const instant = new Date("2026-08-18T23:30:00Z");

    expect(localCollectionDate("Asia/Tokyo", instant)).toBe("2026-08-19");
    expect(localCollectionDate("Asia/Singapore", instant)).toBe("2026-08-19");
    expect(localCollectionDate("UTC", instant)).toBe("2026-08-18");
  });
});
