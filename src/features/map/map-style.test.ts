import { describe, expect, it } from "vitest";

import { createMapStyleProvider, createPaperStyle } from "@/src/features/map/map-style";

describe("map style provider", () => {
  it("uses an offline deterministic style when no MapTiler key is configured", () => {
    const provider = createMapStyleProvider();

    expect(provider.isOffline).toBe(true);
    // The offline style draws only a graticule generated in this repository, so
    // nothing about it is legally required attribution. Naming the supplier is a
    // reviewer diagnostic and is carried separately.
    expect(provider.attribution).toBeNull();
    expect(provider.diagnosticAttribution).toBe(
      "Nib Atlas offline field-journal basemap — no tile provider configured",
    );
    expect(provider.getStyle()).toEqual(createPaperStyle());
  });

  it("uses a MapTiler vector style without leaking supplier data into domain state", () => {
    const provider = createMapStyleProvider(" public test/key ");
    const style = new URL(provider.getStyle() as string);

    expect(provider.isOffline).toBe(false);
    // MapTiler's own style sources carry the required line; a custom copy would
    // render it twice.
    expect(provider.attribution).toBeNull();
    expect(provider.diagnosticAttribution).toContain("MapTiler");
    expect(style.origin).toBe("https://api.maptiler.com");
    expect(style.pathname).toBe("/maps/dataviz-light/style.json");
    expect(style.searchParams.get("key")).toBe("public test/key");
  });
});
