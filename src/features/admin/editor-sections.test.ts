import { describe, expect, it } from "vitest";
import {
  LEGACY_FIELDS,
  LEGACY_GROUPS,
  PRIVATE_FIELDS,
  SECTIONS,
  SECTION_FIELDS,
  SECTION_GROUPS,
  sectionForFix,
  sectionForPath,
} from "./editor-sections";
import { GROUPS, SHOP_FIELDS } from "./shop-contract";
import { publicationFix } from "./publication-fix";
import { document } from "./shop-contract";

const REQUIREMENTS = [
  "Add country, locality, timezone and valid coordinates.",
  "Choose one primary shop type.",
  "Add the street address.",
  "Check and confirm the saved shop position.",
  "Prepare an active Atlas Stamp with approved artwork (artwork package).",
];

const draft = document({
  shop: {
    name: "Synthetic",
    slug: "synthetic",
    source_quality: "demo",
    operational_status: "unknown",
    position_precision: "street",
  },
  sources: [],
  aliases: [],
  links: [],
  types: [],
  services: [],
  specialties: [],
  brands: [],
});

describe("approved seven-section layout", () => {
  it("is exactly the approved sections, in the approved order", () => {
    expect(SECTIONS.map((s) => s.title)).toEqual([
      "Shop & story",
      "Experiences",
      "Location",
      "Visit details",
      "Photos & logo",
      "Stamp",
      "Review",
    ]);
  });

  it("places every shared shop field somewhere reachable, exactly once", () => {
    const placed = [
      ...Object.values(SECTION_FIELDS).flat(),
      ...PRIVATE_FIELDS,
      ...LEGACY_FIELDS,
    ];
    expect(new Set(placed).size).toBe(placed.length);
    expect([...placed].sort()).toEqual([...SHOP_FIELDS.map((f) => f.key)].sort());
  });

  it("places every repeatable group somewhere reachable, exactly once", () => {
    const placed = [...Object.values(SECTION_GROUPS).flat(), ...LEGACY_GROUPS];
    expect(new Set(placed).size).toBe(placed.length);
    expect([...placed].sort()).toEqual([...GROUPS.map((g) => g.key as string)].sort());
  });

  it("removes no approved field to make the layout simpler", () => {
    for (const key of [
      "feature_headline",
      "field_note_heading",
      "field_note_body",
      "local_address",
      "unit_floor",
      "nearest_station",
      "station_exit",
      "walking_guidance",
      "entrance_notes",
      "editions_text",
      "payment_methods",
      "languages",
      "holiday_note",
      "accessibility_notes",
      "appointment_required",
      "postal_code",
    ])
      expect(Object.values(SECTION_FIELDS).flat()).toContain(key);
  });
});

describe("correction routing", () => {
  it("sends a field error to the section that holds the field", () => {
    expect(sectionForPath("shop.name")).toBe("story");
    expect(sectionForPath("shop.slug")).toBe("story");
    expect(sectionForPath("shop.timezone")).toBe("visit");
    expect(sectionForPath("shop.latitude")).toBe("location");
    expect(sectionForPath("shop.locality_id")).toBe("location");
    expect(sectionForPath("shop.opening_hours.entries.0.opens")).toBe("visit");
    expect(sectionForPath("experiences.2.title")).toBe("experiences");
    expect(sectionForPath("brands.0.brand_id")).toBe("experiences");
    expect(sectionForPath("aliases.0.alias")).toBe("story");
  });

  it("keeps private and legacy material with the section that shows it", () => {
    expect(sectionForPath("shop.internal_notes")).toBe("story");
    expect(sectionForPath("shop.reference_links")).toBe("story");
    expect(sectionForPath("shop.source_quality")).toBe("review");
    expect(sectionForPath("sources.0.label")).toBe("review");
    expect(sectionForPath("links.0.url")).toBe("review");
  });

  it("falls back to a real section rather than a blank one", () => {
    expect(SECTIONS.map((s) => s.id)).toContain(sectionForPath("unknown.0.thing"));
  });

  it("routes every server publication requirement to a section that can fix it", () => {
    const routed = REQUIREMENTS.map((r) => sectionForFix(publicationFix(r, draft)));
    expect(routed).toEqual(["location", "experiences", "location", "location", "stamp"]);
    for (const id of routed) expect(SECTIONS.map((s) => s.id)).toContain(id);
  });

  it("never strands an unrecognised requirement outside the editor", () => {
    expect(sectionForFix(publicationFix("Something new from the server.", draft))).toBe(
      "review",
    );
  });
});
