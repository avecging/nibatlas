import { describe, expect, it } from "vitest";

import { demoShops } from "@/src/fixtures/demo-shops";
import {
  demoShopDetails,
  demoShopSummaries,
} from "@/src/fixtures/demo-catalogue";

describe("demo shop fixtures", () => {
  it("are explicitly marked as demo data", () => {
    expect(demoShops).toHaveLength(3);

    for (const shop of demoShops) {
      expect(shop.sourceQuality).toBe("demo");
      expect(shop.fixtureNotice).toMatch(/not a verified business/i);
    }
  });

  it("cover each approved launch country", () => {
    expect(new Set(demoShops.map((shop) => shop.countryCode))).toEqual(
      new Set(["SG", "JP", "TW"]),
    );
  });

  it("projects the same specialty line used by the detail catalogue", () => {
    for (const summary of demoShopSummaries) {
      const detail = demoShopDetails.find((shop) => shop.id === summary.id);
      const expected = detail?.specialties[0] ?? detail?.services[0] ?? null;

      expect(summary.specialtyLine).toBe(expected);
    }
  });
});
