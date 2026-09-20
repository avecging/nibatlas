/**
 * The approved seven sections of the shop editor.
 *
 * Every section is directly reachable: the nav is a set of buttons, not a
 * wizard that forces an editor through optional fields in order. The field
 * keys below are a *layout* over the existing shared `SHOP_FIELDS` contract —
 * they add no field and remove none, so manual editing and Package C imports
 * keep writing the same document.
 */
export type SectionId =
  | "story"
  | "experiences"
  | "location"
  | "visit"
  | "photos"
  | "stamp"
  | "review";

export interface EditorSection {
  id: SectionId;
  /** Short label for the section nav. */
  title: string;
  /** One line under the section heading. */
  intro: string;
}

export const SECTIONS: EditorSection[] = [
  {
    id: "story",
    title: "Shop & story",
    intro:
      "Public identity and the writing that makes this shop worth visiting.",
  },
  {
    id: "experiences",
    title: "Experiences",
    intro:
      "What a visitor can do here, the brands to look for and any store editions. Leave it empty if you have not checked yet.",
  },
  {
    id: "location",
    title: "Location",
    intro:
      "Address and map position together. A postcode helps but does not block a useful listing.",
  },
  {
    id: "visit",
    title: "Visit details",
    intro:
      "Timezone, contact and opening hours. Business status is separate from opening hours, and unknown hours stay unknown.",
  },
  {
    id: "photos",
    title: "Photos & logo",
    intro:
      "Upload photos and a logo. Each image stays private until you deliberately show it on the public page.",
  },
  {
    id: "stamp",
    title: "Stamp",
    intro:
      "The Atlas Stamp visitors collect. A generated default is ready without any upload.",
  },
  {
    id: "review",
    title: "Review",
    intro:
      "Check the saved listing, clear anything still blocking publication, then publish deliberately.",
  },
];

/** Shop-document field keys shown in each editable section, in display order. */
export const SECTION_FIELDS: Record<SectionId, string[]> = {
  story: [
    "name",
    "slug",
    "operational_status",
    "website_url",
    "short_description",
    "feature_headline",
    "field_note_heading",
    "field_note_body",
  ],
  experiences: ["editions_text"],
  location: [
    "country_code",
    "locality_id",
    "city_display",
    "admin_area_name",
    "admin_area_code",
    "neighbourhood",
    "address_line_1",
    "address_line_2",
    "local_address",
    "unit_floor",
    "postal_code",
    "latitude",
    "longitude",
    "position_precision",
    "nearest_station",
    "station_exit",
    "walking_guidance",
    "entrance_notes",
  ],
  visit: [
    "timezone",
    "phone",
    "holiday_note",
    "payment_methods",
    "languages",
    "appointment_required",
    "accessibility_notes",
  ],
  photos: [],
  stamp: [],
  review: [],
};

/** Repeatable `GROUPS` keys shown in each section, in display order. */
export const SECTION_GROUPS: Record<SectionId, string[]> = {
  story: ["aliases"],
  experiences: ["experiences", "types", "specialties", "services", "brands"],
  location: [],
  visit: [],
  photos: [],
  stamp: [],
  review: [],
};

/** Private, admin-only material, kept in a clearly labelled subsection. */
export const PRIVATE_FIELDS = ["internal_notes", "reference_links"];

/** Retained for existing records; never a publication requirement. */
export const LEGACY_FIELDS = ["source_quality", "last_verified_at"];

/** Legacy provenance rows, retained but out of the ordinary editing path. */
export const LEGACY_GROUPS = ["sources", "links"];

const SECTION_OF_FIELD = new Map<string, SectionId>();
for (const section of SECTIONS)
  for (const key of SECTION_FIELDS[section.id]) SECTION_OF_FIELD.set(key, section.id);
const SECTION_OF_GROUP = new Map<string, SectionId>();
for (const section of SECTIONS)
  for (const key of SECTION_GROUPS[section.id]) SECTION_OF_GROUP.set(key, section.id);

/**
 * Which section holds a `fieldErrors` path such as `shop.timezone` or
 * `experiences.0.title`, so a correction link can open the right section.
 * Private and legacy material resolves to the section that contains it.
 */
export function sectionForPath(path: string): SectionId {
  const parts = path.split(".");
  if (parts[0] === "shop") {
    const key = parts[1] ?? "";
    if (key === "opening_hours") return "visit";
    if (PRIVATE_FIELDS.includes(key)) return "story";
    if (LEGACY_FIELDS.includes(key)) return "review";
    return SECTION_OF_FIELD.get(key) ?? "story";
  }
  if (LEGACY_GROUPS.includes(parts[0] ?? "")) return "review";
  return SECTION_OF_GROUP.get(parts[0] ?? "") ?? "story";
}

/**
 * Which section holds the destination `publicationFix` chose for a server
 * publication requirement. Anchor ids are resolved here so the requirement
 * strings themselves are matched in exactly one place.
 */
export function sectionForFix(fix: { path?: string; id?: string }): SectionId {
  if (fix.path) return sectionForPath(fix.path);
  return ANCHOR_SECTIONS[fix.id ?? ""] ?? "review";
}

const ANCHOR_SECTIONS: Record<string, SectionId> = {
  "confirm-shop-position": "location",
  "shop-stamp-artwork": "stamp",
  "shop-publication": "review",
};
