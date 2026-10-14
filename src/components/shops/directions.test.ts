import { describe, expect, it } from "vitest";

import { detectMapPlatform, directionsHref } from "@/src/components/shops/directions";
import { findPrototypeShop } from "@/src/fixtures/prototype-catalogue";

const shop = findPrototypeShop("ginza-itoya-main-store")!;

describe("detectMapPlatform", () => {
  it("reads Android before iOS, because Android sends Mobile Safari too", () => {
    expect(
      detectMapPlatform(
        "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Mobile Safari/537.36",
      ),
    ).toBe("android");
  });

  it("recognises Apple platforms", () => {
    expect(detectMapPlatform("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)")).toBe("ios");
    expect(detectMapPlatform("Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X)")).toBe("ios");
    expect(
      detectMapPlatform("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Version/18.0 Safari/605"),
    ).toBe("ios");
  });

  it("falls back for a desktop browser, or for no user agent at all", () => {
    expect(detectMapPlatform("Mozilla/5.0 (X11; Linux x86_64) Chrome/126")).toBe("other");
    expect(detectMapPlatform(undefined)).toBe("other");
    expect(detectMapPlatform("")).toBe("other");
  });
});

describe("directionsHref", () => {
  it("hands an Apple platform to Maps, on foot", () => {
    const href = directionsHref(shop, "ios");

    expect(href).toBe("https://maps.apple.com/?daddr=35.6721%2C139.7669&dirflg=w");
  });

  it("hands Android the geo intent, labelled with the shop's name", () => {
    const href = directionsHref(shop, "android");

    expect(href).toBe(
      "geo:35.6721,139.7669?q=35.6721%2C139.7669(Ginza%20Itoya%20Main%20Store)",
    );
  });

  it("keeps OpenStreetMap where there is no application to hand to", () => {
    expect(directionsHref(shop, "other")).toBe(
      "https://www.openstreetmap.org/directions?to=35.6721%2C139.7669",
    );
  });

  it("carries the destination only — never a user position", () => {
    for (const platform of ["ios", "android", "other"] as const) {
      const href = directionsHref(shop, platform);

      expect(href).toContain("35.6721");
      expect(href).not.toMatch(/saddr|from=|origin/);
    }
  });
});
