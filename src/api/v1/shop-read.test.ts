import { describe, expect, it } from "vitest";

import {
  decodeShopDetailV1,
  decodeViewportShopsV1,
  ShopReadContractError,
} from "@/src/api/v1/shop-read";

const SOURCE_ID = "00000000-0000-4000-8000-000000000501";
const OTHER_SOURCE_ID = "00000000-0000-4000-8000-000000000502";

const MAP_SHOP = {
  id: "00000000-0000-4000-8000-000000000301",
  slug: "contract-shop",
  name: "Contract Shop",
  countryCode: "SG",
  localityName: "Singapore",
  position: { latitude: 1.29, longitude: 103.85 },
  primaryType: "fountain_pen_specialist",
  specialtyLine: null,
  operationalStatus: "unknown",
  markerState: "unvisited",
  sourceQuality: "demo",
};

function detail() {
  return {
    ...MAP_SHOP,
    timezone: "Asia/Singapore",
    positionPrecision: "locality",
    shopTypes: ["fountain_pen_specialist"],
    specialties: [],
    services: [{ label: "Nib tuning", confirmedBy: SOURCE_ID }],
    brands: [],
    links: [],
    sources: [{
      id: SOURCE_ID,
      label: "A mutable display label",
      kind: "demo_fixture",
      retrievedOn: "2026-09-02",
      confirms: ["Service: Nib tuning"],
    }],
  };
}

describe("v1 shop read runtime contract", () => {
  it("preserves explicit-null specialtyLine", () => {
    const decoded = decodeViewportShopsV1({
      shops: [MAP_SHOP],
      truncated: false,
      committedBounds: { west: 103, south: 1, east: 104, north: 2 },
    });

    expect(decoded.shops[0]).toHaveProperty("specialtyLine", null);
  });

  it("rejects an omitted specialtyLine instead of turning unknown into absence", () => {
    const malformed = { ...MAP_SHOP } as Record<string, unknown>;
    delete malformed["specialtyLine"];

    expect(() => decodeViewportShopsV1({
      shops: [malformed],
      truncated: false,
      committedBounds: { west: 103, south: 1, east: 104, north: 2 },
    })).toThrow(ShopReadContractError);
  });

  it("rejects user state in the cacheable public catalogue projection", () => {
    expect(() => decodeViewportShopsV1({
      shops: [{ ...MAP_SHOP, markerState: "saved" }],
      truncated: false,
      committedBounds: { west: 103, south: 1, east: 104, north: 2 },
    })).toThrow(/markerState must be unvisited/);
  });

  it("accepts demo_fixture explicitly and keeps evidence attached by UUID", () => {
    const payload = detail();
    payload.sources[0]!.label = "A renamed display label";

    const decoded = decodeShopDetailV1(payload);

    expect(decoded?.sources[0]).toMatchObject({ id: SOURCE_ID, kind: "demo_fixture" });
    expect(decoded?.services[0]?.confirmedBy).toBe(SOURCE_ID);
  });

  it("rejects source labels and malformed identifiers as evidence references", () => {
    const labelReference = detail();
    labelReference.services[0]!.confirmedBy = labelReference.sources[0]!.label;
    expect(() => decodeShopDetailV1(labelReference)).toThrow(/must be a UUID/);

    const malformedSource = detail();
    malformedSource.sources[0]!.id = "not-a-uuid";
    expect(() => decodeShopDetailV1(malformedSource)).toThrow(/must be a UUID/);
  });

  it("requires the referenced source itself to confirm the service token", () => {
    const payload = detail();
    payload.sources = [
      { ...payload.sources[0]!, confirms: ["Address"] },
      {
        id: OTHER_SOURCE_ID,
        label: "The source that confirms the service",
        kind: "official",
        retrievedOn: "2026-09-02",
        confirms: ["Service: Nib tuning"],
      },
    ];

    expect(() => decodeShopDetailV1(payload)).toThrow(/claim-not-confirmed/);
  });

  it("strips unknown keys while rejecting malformed known fields", () => {
    const payload = { ...detail(), evidenceNote: "admin only" };
    const decoded = decodeShopDetailV1(payload);
    expect(decoded).not.toHaveProperty("evidenceNote");

    expect(() => decodeShopDetailV1({ ...payload, sources: {} })).toThrow(
      /detail.sources must be an array/,
    );
  });
});
