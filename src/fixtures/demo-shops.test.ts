import { describe, expect, it } from "vitest";

import { demoShops } from "@/src/fixtures/demo-shops";

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
});
