import { describe, expect, it } from "vitest";

import {
  catalogueModeDiagnostic,
  resolveCatalogueMode,
} from "@/src/features/catalogue/catalogue-mode";

describe("catalogue mode resolution", () => {
  it("defaults to fixtures when nothing is configured", () => {
    for (const raw of [undefined, null, "", "   "]) {
      expect(resolveCatalogueMode(raw)).toEqual({
        mode: "fixture",
        explicit: false,
        demoRecords: true,
      });
    }
  });

  it("selects each mode explicitly", () => {
    expect(resolveCatalogueMode("api")).toEqual({
      mode: "api",
      explicit: true,
      demoRecords: false,
    });
    expect(resolveCatalogueMode(" FIXTURE ")).toEqual({
      mode: "fixture",
      explicit: true,
      demoRecords: true,
    });
  });

  it("accepts demo-quality staging records only under api-demo", () => {
    expect(resolveCatalogueMode("api-demo").demoRecords).toBe(true);
    expect(resolveCatalogueMode("api").demoRecords).toBe(false);
  });

  /*
   * The rule issue #25 is explicit about: a broken API configuration must not
   * become fixture data. Fixtures rendered during an outage would look like a
   * working catalogue that had simply lost most of its shops.
   */
  it("never falls back to fixtures for an unrecognised value", () => {
    const resolution = resolveCatalogueMode("supabase");

    expect(resolution.mode).toBe("misconfigured");
    expect(resolution.value).toBe("supabase");
    expect(resolution.demoRecords).toBe(false);
  });

  it("names the live supplier for a reviewer", () => {
    expect(catalogueModeDiagnostic(resolveCatalogueMode("api"))).toContain("read API");
    expect(catalogueModeDiagnostic(resolveCatalogueMode(undefined))).toContain(
      "fixtures (default)",
    );
    expect(catalogueModeDiagnostic(resolveCatalogueMode("nonsense"))).toContain(
      "misconfigured",
    );
  });
});
