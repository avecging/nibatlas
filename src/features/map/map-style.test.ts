import { describe, expect, it } from "vitest";

import { createMapStyleProvider, createPaperStyle } from "@/src/features/map/map-style";

describe("map style provider", () => {
  it("uses an offline deterministic style when no MapTiler key is configured", () => {
    const provider = createMapStyleProvider();

    expect(provider.isOffline).toBe(true);
    expect(provider.attribution).toBe(
      "Nib Atlas demo basemap — no tile provider configured",
    );
    expect(provider.getStyle()).toEqual(createPaperStyle());
  });

  it("uses a MapTiler vector style without leaking supplier data into domain state", () => {
    const provider = createMapStyleProvider(" public test/key ");
    const style = new URL(provider.getStyle() as string);

    expect(provider.isOffline).toBe(false);
    expect(provider.attribution).toBeNull();
    expect(style.origin).toBe("https://api.maptiler.com");
    expect(style.pathname).toBe("/maps/dataviz-light/style.json");
    expect(style.searchParams.get("key")).toBe("public test/key");
  });
});
