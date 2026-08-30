import { describe, expect, it } from "vitest";

import { distanceLabel, nearbyPenShops } from "@/src/domain/nearby-shops";
import type { ShopDetail } from "@/src/domain/shop-detail";
import { findPrototypeShop, prototypeShopDetails } from "@/src/fixtures/prototype-catalogue";
import { shopValueSpecimen } from "@/src/fixtures/shop-value-specimen";

function shop(patch: Partial<ShopDetail> & { readonly id: string }): ShopDetail {
  return { ...shopValueSpecimen, ...patch };
}

/*
 * `Approx.` replaced `about` in the founder's staging review of WP4: it carries
 * the qualification on its own, which is what let the separate straight-line
 * paragraph under the list go.
 */
describe("distanceLabel", () => {
  it("rounds to 50 m under a kilometre, because neither point is surveyed", () => {
    expect(distanceLabel(412)).toBe("Approx. 400 m away");
    expect(distanceLabel(438)).toBe("Approx. 450 m away");
  });

  it("never rounds down to nothing", () => {
    expect(distanceLabel(4)).toBe("Approx. 50 m away");
  });

  it("switches to kilometres with one decimal above a kilometre", () => {
    expect(distanceLabel(1_240)).toBe("Approx. 1.2 km away");
    expect(distanceLabel(4_950)).toBe("Approx. 5.0 km away");
  });
});

describe("nearbyPenShops", () => {
  const origin = shop({
    id: "origin",
    localityName: "Testville",
    position: { latitude: 1.3, longitude: 103.85 },
    positionPrecision: "street",
  });

  it("never includes the shop itself", () => {
    expect(nearbyPenShops(origin, [origin])).toEqual([]);
  });

  it("measures a distance only when both points came from a street address", () => {
    const streetPeer = shop({
      id: "street-peer",
      name: "Street Peer",
      localityName: "Testville",
      position: { latitude: 1.302, longitude: 103.85 },
      positionPrecision: "street",
    });
    const localityPeer = shop({
      id: "locality-peer",
      name: "Locality Peer",
      localityName: "Testville",
      position: { latitude: 1.31, longitude: 103.85 },
      positionPrecision: "locality",
    });

    const nearby = nearbyPenShops(origin, [origin, streetPeer, localityPeer]);

    expect(nearby.map((entry) => entry.shop.id)).toEqual([
      "street-peer",
      "locality-peer",
    ]);
    expect(nearby[0]?.distanceMeters).toBeGreaterThan(180);
    expect(nearby[0]?.distanceMeters).toBeLessThan(260);
    // A city-centroid coordinate would make any figure a claim of precision the
    // record does not have, so the entry appears without one.
    expect(nearby[1]?.distanceMeters).toBeNull();
    expect(nearby[1]?.sameLocality).toBe(true);
  });

  it("keeps a different locality only when it is measurably close", () => {
    const nextTown = shop({
      id: "next-town",
      name: "Next Town",
      localityName: "Otherville",
      position: { latitude: 1.32, longitude: 103.85 },
      positionPrecision: "street",
    });
    const farTown = shop({
      id: "far-town",
      name: "Far Town",
      localityName: "Distantville",
      position: { latitude: 2.3, longitude: 103.85 },
      positionPrecision: "street",
    });
    const unmeasurableTown = shop({
      id: "unmeasurable",
      name: "Unmeasurable",
      localityName: "Vagueville",
      position: { latitude: 1.301, longitude: 103.85 },
      positionPrecision: "locality",
    });

    const nearby = nearbyPenShops(origin, [
      origin,
      nextTown,
      farTown,
      unmeasurableTown,
    ]);

    expect(nearby.map((entry) => entry.shop.id)).toEqual(["next-town"]);
  });

  it("orders measured pairs nearest first, then the rest by name", () => {
    const near = shop({
      id: "near",
      name: "Zeta",
      localityName: "Testville",
      position: { latitude: 1.301, longitude: 103.85 },
      positionPrecision: "street",
    });
    const further = shop({
      id: "further",
      name: "Alpha",
      localityName: "Testville",
      position: { latitude: 1.305, longitude: 103.85 },
      positionPrecision: "street",
    });
    const vagueB = shop({
      id: "vague-b",
      name: "Beta",
      localityName: "Testville",
      positionPrecision: "locality",
    });
    const vagueA = shop({
      id: "vague-a",
      name: "Aardvark",
      localityName: "Testville",
      positionPrecision: "locality",
    });

    const nearby = nearbyPenShops(origin, [origin, further, near, vagueB, vagueA]);

    expect(nearby.map((entry) => entry.shop.id)).toEqual([
      "near",
      "further",
      "vague-a",
      "vague-b",
    ]);
  });

  it("leaves out a permanently closed shop", () => {
    const closed = shop({
      id: "closed",
      localityName: "Testville",
      operationalStatus: "permanently_closed",
      positionPrecision: "street",
      position: { latitude: 1.301, longitude: 103.85 },
    });

    expect(nearbyPenShops(origin, [origin, closed])).toEqual([]);
  });

  it("caps the list, so the section stays context rather than a directory", () => {
    const peers = Array.from({ length: 8 }, (_unused, index) =>
      shop({
        id: `peer-${index}`,
        name: `Peer ${index}`,
        localityName: "Testville",
        positionPrecision: "street",
        position: { latitude: 1.3 + (index + 1) / 10_000, longitude: 103.85 },
      }),
    );

    expect(nearbyPenShops(origin, [origin, ...peers])).toHaveLength(4);
    expect(nearbyPenShops(origin, [origin, ...peers], 2)).toHaveLength(2);
  });
});

describe("nearbyPenShops over the prototype catalogue", () => {
  it("pairs the two Kobe shops without inventing a distance between them", () => {
    const main = findPrototypeShop("nagasawa-stationery-center-main-store")!;
    const nearby = nearbyPenShops(main, prototypeShopDetails);

    expect(nearby.map((entry) => entry.shop.slug)).toEqual([
      "nagasawa-penstyle-den",
    ]);
    expect(nearby[0]?.distanceMeters).toBeNull();
  });

  it("measures the two Singapore shops, which both have sourced addresses", () => {
    const aestheticBay = findPrototypeShop("aesthetic-bay")!;
    const nearby = nearbyPenShops(aestheticBay, prototypeShopDetails);

    expect(nearby.map((entry) => entry.shop.slug)).toEqual(["fook-hing-trading"]);
    expect(nearby[0]?.distanceMeters).not.toBeNull();
  });

  it("offers nothing where a shop has no catalogue neighbour in reach", () => {
    const skb = findPrototypeShop("skb-kaohsiung")!;

    expect(nearbyPenShops(skb, prototypeShopDetails)).toEqual([]);
  });
});
