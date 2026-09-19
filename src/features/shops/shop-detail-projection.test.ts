import { describe, expect, it } from "vitest";

import type { ShopDetailReadV1 } from "@/src/api/v1/shop-read";
import {
  projectShopDetail,
  ShopDetailProjectionError,
} from "@/src/features/shops/shop-detail-projection";
import { shopEvidenceIssues } from "@/src/domain/shop-evidence";
import { STAMP_DESIGN_VERSION } from "@/src/domain/stamp-design";
import { STAMP_PALETTE_VERSION } from "@/src/domain/stamp-palette";

const SOURCE_ID = "00000000-0000-4000-8000-000000000501";

function wire(overrides: Partial<ShopDetailReadV1> = {}): ShopDetailReadV1 {
  return {
    id: "00000000-0000-4000-8000-000000000301",
    slug: "contract-shop",
    name: "Contract Shop",
    countryCode: "JP",
    localityName: "Kobe",
    position: { latitude: 34.69, longitude: 135.19 },
    primaryType: "fountain_pen_specialist",
    specialtyLine: null,
    operationalStatus: "open",
    markerState: "unvisited",
    sourceQuality: "sourced",
    timezone: "Asia/Tokyo",
    positionPrecision: "street",
    shopTypes: ["fountain_pen_specialist"],
    specialties: [],
    services: [{ label: "Nib tuning", confirmedBy: SOURCE_ID }],
    brands: [],
    links: [],
    sources: [
      {
        id: SOURCE_ID,
        label: "The shop's own site",
        kind: "official",
        retrievedOn: "2026-09-02",
        confirms: ["Service: Nib tuning"],
      },
    ],
    ...overrides,
  };
}

describe("shop detail projection", () => {
  it("carries the record through as public, unvisited domain state", () => {
    const shop = projectShopDetail(wire(), { demoRecords: false });

    expect(shop.slug).toBe("contract-shop");
    expect(shop.markerState).toBe("unvisited");
    expect(shop.sources).toHaveLength(1);
    // The evidence rule still holds on the projected record, not only on the wire.
    expect(shopEvidenceIssues(shop)).toEqual([]);
  });

  it("omits empty collections rather than rendering empty sections", () => {
    const shop = projectShopDetail(
      wire({ services: [], brands: [], specialties: [], links: [] }),
      { demoRecords: false },
    );

    expect(shop.services).toBeUndefined();
    expect(shop.brands).toBeUndefined();
    expect(shop.specialties).toBeUndefined();
    expect(shop.links).toBeUndefined();
  });

  it("generates a stamp design deterministically, pinned to both versions", () => {
    const first = projectShopDetail(wire(), { demoRecords: false }).stamp;
    const second = projectShopDetail(wire(), { demoRecords: false }).stamp;

    expect(first).toEqual(second);
    expect(first.id).toBe("stamp-contract-shop");
    expect(first.tier).toBe("shop");
    expect(first.designVersion).toBe(STAMP_DESIGN_VERSION);
    expect(first.paletteVersion).toBe(STAMP_PALETTE_VERSION);
    expect(first.countryLabel).toBe("Japan");
  });

  it("labels a link from its own URL when the record gives no label", () => {
    const shop = projectShopDetail(
      wire({ links: [{ type: "website", url: "https://www.example.jp/shop", isOfficial: true }] }),
      { demoRecords: false },
    );

    expect(shop.links?.[0]?.label).toBe("example.jp");
  });

  it("folds the record's own website into the contextual links, once", () => {
    const shop = projectShopDetail(
      wire({
        websiteUrl: "https://example.jp/",
        links: [{ type: "website", url: "https://example.jp/", isOfficial: true }],
      }),
      { demoRecords: false },
    );

    expect(shop.links).toHaveLength(1);
  });

  it("rejects an unparseable link URL", () => {
    expect(() =>
      projectShopDetail(wire({ links: [{ type: "website", url: "not a url", isOfficial: false }] }), {
        demoRecords: false,
      }),
    ).toThrow(ShopDetailProjectionError);
  });

  it("rejects a demo record outside a demo-accepting mode", () => {
    const demo = wire({
      sourceQuality: "demo",
      fixtureNotice: "Demo fixture — not a verified business listing",
      sources: [
        {
          id: SOURCE_ID,
          label: "Demo evidence",
          kind: "demo_fixture",
          retrievedOn: "2026-09-02",
          confirms: ["Service: Nib tuning"],
        },
      ],
    });

    expect(() => projectShopDetail(demo, { demoRecords: false })).toThrow(
      ShopDetailProjectionError,
    );

    const accepted = projectShopDetail(demo, { demoRecords: true });

    // Accepted, never recast: the demo kind survives as itself.
    expect(accepted.sources[0]?.kind).toBe("demo_fixture");
    expect(accepted.fixtureNotice).toMatch(/not a verified business/i);
  });

  it("rejects the demo source kind on a record that is not demo quality", () => {
    expect(() =>
      projectShopDetail(
        wire({
          sources: [
            {
              id: SOURCE_ID,
              label: "Demo evidence",
              kind: "demo_fixture",
              retrievedOn: "2026-09-02",
              confirms: ["Service: Nib tuning"],
            },
          ],
        }),
        { demoRecords: true },
      ),
    ).toThrow(ShopDetailProjectionError);
  });

  it("rejects a demo record that arrives without its fixture notice", () => {
    expect(() =>
      projectShopDetail(
        wire({
          sourceQuality: "demo",
          sources: [
            {
              id: SOURCE_ID,
              label: "Demo evidence",
              kind: "demo_fixture",
              retrievedOn: "2026-09-02",
              confirms: ["Service: Nib tuning"],
            },
          ],
        }),
        { demoRecords: true },
      ),
    ).toThrow(ShopDetailProjectionError);
  });
});

it('uses stored default art and identity across ordinary name and slug changes',()=>{
  const generatedStamp={id:'00000000-0000-4000-8000-000000000601',designVersion:3,ink:'plum' as const,paletteVersion:1,templateData:{tier:'shop' as const,motif:'counter' as const}};
  const original=projectShopDetail(wire({generatedStamp}),{demoRecords:false});
  const renamed=projectShopDetail(wire({generatedStamp,name:'Changed',slug:'changed'}),{demoRecords:false});
  expect(original.stamp).toEqual(renamed.stamp);
  expect(original.stamp).toMatchObject({id:generatedStamp.id,designVersion:3,ink:'plum',motif:'counter'});
});
