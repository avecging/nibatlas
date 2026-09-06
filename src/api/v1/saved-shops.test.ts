import { describe, expect, it } from "vitest";

import {
  decodeSavedShopsV1,
  SavedShopContractError,
} from "@/src/api/v1/saved-shops";

const SAVED_SHOP = {
  id: "00000000-0000-4000-8000-000000000301",
  slug: "m2-singapore-demo-fixture",
  name: "M2 Singapore Demo Fixture",
  countryCode: "SG",
  localityName: "Singapore",
  position: { latitude: 1.29027, longitude: 103.851959 },
  primaryType: "fountain_pen_specialist",
  specialtyLine: null,
  operationalStatus: "unknown",
  markerState: "saved",
  sourceQuality: "demo",
  fixtureNotice: "Demo data",
  savedAt: "2026-09-04T16:30:00+00:00",
};

describe("saved-shop v1 contract", () => {
  it("decodes aligned identifiers and catalogue-compatible details", () => {
    expect(decodeSavedShopsV1({
      savedShopIds: [SAVED_SHOP.id],
      shops: [SAVED_SHOP],
      userId: "must be stripped",
    })).toEqual({
      savedShopIds: [SAVED_SHOP.id],
      shops: [SAVED_SHOP],
    });
  });

  it("rejects mismatched identifiers, non-saved markers and dishonest demo rows", () => {
    expect(() => decodeSavedShopsV1({
      savedShopIds: ["00000000-0000-4000-8000-000000000302"],
      shops: [SAVED_SHOP],
    })).toThrow(SavedShopContractError);
    expect(() => decodeSavedShopsV1({
      savedShopIds: [SAVED_SHOP.id],
      shops: [{ ...SAVED_SHOP, markerState: "unvisited" }],
    })).toThrow(SavedShopContractError);
    expect(() => decodeSavedShopsV1({
      savedShopIds: [SAVED_SHOP.id],
      shops: [{ ...SAVED_SHOP, fixtureNotice: undefined }],
    })).toThrow(SavedShopContractError);
  });
});
