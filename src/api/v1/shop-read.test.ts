import { describe, expect, it } from "vitest";

import {
  decodeNearbyShopsV1,
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

  it("keeps Nearby precision, type, and operational status explicit", () => {
    const decoded = decodeNearbyShopsV1({
      radiusMeters: 5000,
      shops: [
        {
          id: MAP_SHOP.id,
          slug: MAP_SHOP.slug,
          name: MAP_SHOP.name,
          countryCode: MAP_SHOP.countryCode,
          localityName: MAP_SHOP.localityName,
          position: MAP_SHOP.position,
          positionPrecision: "street",
          primaryType: MAP_SHOP.primaryType,
          operationalStatus: "open",
          distanceMeters: 125,
        },
      ],
    });

    expect(decoded.shops[0]).toMatchObject({
      positionPrecision: "street",
      primaryType: "fountain_pen_specialist",
      operationalStatus: "open",
    });
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
    const payload = {
      ...detail(),
      evidenceNote: "admin only",
      appointmentRequired: true,
      accessibilityNotes: "Unsourced internal claim",
    };
    const decoded = decodeShopDetailV1(payload);
    expect(decoded).not.toHaveProperty("evidenceNote");
    expect(decoded).not.toHaveProperty("appointmentRequired");
    expect(decoded).not.toHaveProperty("accessibilityNotes");

    expect(() => decodeShopDetailV1({ ...payload, sources: {} })).toThrow(
      /detail.sources must be an array/,
    );
  });
});

it("renders a demo test venue without inventing a pen-shop type", () => {
  const venue = { ...detail(), primaryType: "test_venue", shopTypes: ["test_venue"], services: [] };
  expect(decodeShopDetailV1(venue)?.primaryType).toBe("test_venue");
  expect(() => decodeShopDetailV1({ ...venue, sourceQuality: "sourced" })).toThrow(/must remain demo/);
});

it('decodes only the public stored generated design and rejects malformed art',()=>{
  const art={id:'00000000-0000-4000-8000-000000000601',designVersion:3,ink:'plum',paletteVersion:1,templateData:{tier:'shop',motif:'counter'}};
  expect(decodeShopDetailV1({...detail(),generatedStamp:{...art,privateKey:'must-not-survive'}})?.generatedStamp).toEqual(art);
  for(const invalid of [null,{...art,ink:'red'},{...art,paletteVersion:2},{...art,designVersion:0},{...art,templateData:{tier:'shop',motif:'fake'}}])
    expect(()=>decodeShopDetailV1({...detail(),generatedStamp:invalid})).toThrow();
});

describe('B2 trusted editorial public contract', () => {
  const review = { kind: 'editorial', reviewedAt: '2026-09-19T12:34:56.123Z' };
  it('accepts source-free editorial services without manufacturing provenance', () => {
    const result = decodeShopDetailV1({ ...detail(), review, sources: [], services: [{ label: 'Nib tuning', reviewedEditorially: true }] });
    expect(result?.services).toEqual([{ label: 'Nib tuning', reviewedEditorially: true }]);
    expect(result?.sources).toEqual([]);
    expect(result?.review).toEqual(review);
  });
  it('does not let a per-service flag replace a recorded editorial review', () => {
    expect(() => decodeShopDetailV1({ ...detail(), sources: [], services: [{ label: 'Nib tuning', reviewedEditorially: true }] })).toThrow(ShopReadContractError);
    expect(() => decodeShopDetailV1({ ...detail(), review: { ...review, reviewedAt: 'invented' } })).toThrow(ShopReadContractError);
  });
  it('allowlists editorial data and review metadata instead of forwarding private fields', () => {
    const result = decodeShopDetailV1({ ...detail(), review: { ...review, actor: 'private-account' },
      editorial: { field_note_body: 'First\n\n第二段', appointment_required: false, internal_notes: 'PRIVATE', reference_links: 'PRIVATE',
        experiences: [{ id: OTHER_SOURCE_ID, category: 'nib_testing', title: 'Testing', description: 'First\n\nSecond', secret: 'PRIVATE' }] } });
    expect(result?.editorial).toMatchObject({ field_note_body: 'First\n\n第二段', appointment_required: false });
    expect(JSON.stringify(result)).not.toMatch(/PRIVATE|private-account/);
  });
  it('retains legacy sources and their dates when a listing receives editorial review', () => {
    expect(decodeShopDetailV1({ ...detail(), review })?.sources).toEqual(detail().sources);
  });
});

it('custom catalogue types retain labels across map, detail, nearby and reject missing labels',()=>{
  const type='type_85000000_0000_4000_8000_000000000002';
  const row={...MAP_SHOP,primaryType:type,primaryTypeLabel:'手作りペン'};
  const viewport={shops:[row],truncated:false,committedBounds:{west:103,south:1,east:104,north:2}};
  expect(decodeViewportShopsV1(viewport).shops[0]?.primaryTypeLabel).toBe('手作りペン');
  expect(decodeShopDetailV1({...detail(),...row,shopTypes:[type],shopTypeLabels:{[type]:'手作りペン'}})?.shopTypeLabels?.[type]).toBe('手作りペン');
  expect(decodeNearbyShopsV1({shops:[{...row,positionPrecision:'street',distanceMeters:100}],radiusMeters:5000}).shops[0]?.primaryTypeLabel).toBe('手作りペン');
  expect(()=>decodeViewportShopsV1({...viewport,shops:[{...row,primaryTypeLabel:undefined}]})).toThrow(ShopReadContractError);
  expect(()=>decodeShopDetailV1({...detail(),...row,shopTypes:[type]})).toThrow(ShopReadContractError);
  expect(()=>decodeShopDetailV1({...detail(),...row,shopTypes:[type],shopTypeLabels:{[type]:'x'.repeat(301)}})).toThrow(ShopReadContractError);
});
