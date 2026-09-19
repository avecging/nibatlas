/** M6 WP2 contract: catalogue fields only; no stamp, media or import writes. */
export type Value =
  string | number | boolean | null | Value[] | { [key: string]: Value };
export type Row = { [key: string]: Value };
export interface Document {
  shop: Row;
  sources: Row[];
  aliases: Row[];
  links: Row[];
  types: Row[];
  services: Row[];
  specialties: Row[];
  brands: Row[];
  experiences: Row[];
}
export interface ShopRecord {
  id: string;
  publicationStatus: string;
  revision: string;
  hasChanges: boolean;
  document: Document;
  publicationErrors: string[];
  positionConfirmed?: boolean;
}
export interface ShopSummary {
  id: string;
  name: string;
  slug: string;
  publicationStatus: string;
  operationalStatus: string;
  hasChanges: boolean;
}
export interface Option {
  id: string;
  label: string;
  countryCode?: string;
}
export type Options = Record<string, Option[]>;
export type Field = {
  key: string;
  label: string;
  kind?: "number" | "boolean" | "date" | "long" | "claims";
  choices?: readonly string[];
  vocabulary?: string;
  required?: boolean;
  hint?: string;
};
const f = (
  key: string,
  label: string,
  extra: Omit<Field, "key" | "label"> = {},
): Field => ({ key, label, ...extra });
export const SHOP_FIELDS: Field[] = [
  f("feature_headline", "Feature headline", { kind: "long" }),
  f("field_note_heading", "Field-note heading", { kind: "long" }),
  f("field_note_body", "Why this place deserves a visit", { kind: "long" }),
  f("local_address", "Local-language address", { kind: "long" }),
  f("unit_floor", "Unit / floor", { kind: "long" }),
  f("nearest_station", "Nearest station", { kind: "long" }),
  f("station_exit", "Station exit", { kind: "long" }),
  f("walking_guidance", "Walking guidance", { kind: "long" }),
  f("entrance_notes", "Entrance notes", { kind: "long" }),
  f("editions_text", "Store editions", { kind: "long" }),
  f("payment_methods", "Payment methods", { kind: "long" }),
  f("languages", "Languages spoken", { kind: "long" }),
  f("holiday_note", "Holiday note", { kind: "long" }),
  f("internal_notes", "Internal admin notes (private)", { kind: "long" }),
  f("reference_links", "Reference links (private)", { kind: "long" }),
  f("name", "Shop name", { required: true }),
  f("slug", "URL name", {
    required: true,
    hint: "Lowercase words separated by hyphens. Changing this changes the public link.",
  }),
  f("short_description", "Short introduction", { kind: "long" }),
  f("country_code", "Country code", {
    hint: "Two-letter ISO country code, for example SG. Leave unknown facts blank.",
  }),
  f("locality_id", "Locality", { vocabulary: "localities" }),
  f("city_display", "Place display name"),
  f("admin_area_code", "Administrative area code"),
  f("admin_area_name", "Administrative area name"),
  f("neighbourhood", "Neighbourhood"),
  f("timezone", "Timezone", { hint: "IANA name, for example Asia/Singapore." }),
  f("latitude", "Shop latitude", { kind: "number" }),
  f("longitude", "Shop longitude", { kind: "number" }),
  f("position_precision", "Position precision", {
    required: true,
    choices: ["locality", "street"],
    hint: "Street means a sourced venue point, not verified floor or entrance accuracy.",
  }),
  f("address_line_1", "Address line 1"),
  f("address_line_2", "Address line 2"),
  f("postal_code", "Postal code", {
    hint: "Optional text; preserve leading zeroes and letters.",
  }),
  f("phone", "Phone", {
    hint: "As published by the shop; no automatic country prefix.",
  }),
  f("website_url", "Official website"),
  f("appointment_required", "Appointment required", {
    kind: "boolean",
    hint: "Unknown is different from No.",
  }),
  f("accessibility_notes", "Accessibility notes", {
    kind: "long",
    hint: "Public factual notes; leave unknown information blank.",
  }),
  f("operational_status", "Recorded operational status", {
    required: true,
    choices: ["unknown", "open", "temporarily_closed", "permanently_closed"],
  }),
  f("source_quality", "Source quality", {
    required: true,
    choices: ["community_unverified", "sourced", "verified", "demo"],
    hint: "Legacy classification; not a publication requirement. Demo identities stay demo.",
  }),
  f("last_verified_at", "Record review date", {
    kind: "date",
    hint: "Legacy review date; preserved separately. New publication records its actual editor and time automatically.",
  }),
];
export const GROUPS: {
  key: Exclude<keyof Document, "shop">;
  label: string;
  fields: Field[];
}[] = [
  { key: "experiences", label: "Experiences", fields: [
    f("category", "Category", { required: true, choices: ["fountain_pens", "inks_paper", "nib_testing", "gifts", "repairs", "other"] }),
    f("title", "Public title", { required: true }), f("description", "Experience description", { kind: "long" }),
  ] },
  {
    key: "sources",
    label: "Legacy sources (optional)",
    fields: [
      f("label", "Source label", { required: true }),
      f("source_type", "Source kind", {
        required: true,
        choices: [
          "official",
          "brand_dealer_list",
          "community_list",
          "founder_visit",
          "demo_fixture",
        ],
      }),
      f("source_url", "Source URL"),
      f("checked_at", "Date checked", { kind: "date", required: true }),
      f("reliability", "Reliability", {
        required: true,
        choices: ["unknown", "primary", "secondary", "direct"],
      }),
      f("status", "Source status", {
        required: true,
        choices: ["active", "stale", "unavailable"],
      }),
      f("claims", "Claims supported", {
        kind: "claims",
        hint: "One token per line, matching only researched facts. Examples: Name, Location, Address, Opening hours, Shop type: Fountain Pen Specialist. Publicly visible.",
      }),
      f("evidence_note", "Private evidence note", { kind: "long" }),
    ],
  },
  {
    key: "aliases",
    label: "Names and aliases",
    fields: [
      f("alias", "Name or alias", { required: true }),
      f("language_tag", "Language tag", {
        required: true,
        hint: "For example ja-JP; never inferred from country.",
      }),
      f("alias_type", "Name kind", {
        required: true,
        choices: [
          "local_name",
          "romanization",
          "former_name",
          "search_synonym",
        ],
      }),
    ],
  },
  {
    key: "links",
    label: "Links",
    fields: [
      f("link_type", "Link kind", {
        required: true,
        choices: [
          "website",
          "instagram",
          "facebook",
          "x",
          "line",
          "directions",
          "contact",
        ],
      }),
      f("url", "URL", { required: true }),
      f("label", "Link label"),
      f("is_official", "Official link", { kind: "boolean", required: true }),
      f("sort_order", "Display order", { kind: "number", required: true }),
    ],
  },
  ...(["types", "services", "specialties", "brands"] as const).map((key) => ({
    key,
    label: {
      types: "Shop types",
      services: "Services",
      specialties: "Specialties",
      brands: "Brands",
    }[key],
    fields: [
      f(
        {
          types: "shop_type_id",
          services: "service_id",
          specialties: "specialty_id",
          brands: "brand_id",
        }[key],
        "Item",
        { required: true, vocabulary: key },
      ),
      f("source_id", "Supporting source", { vocabulary: "sources" }),
      f("note", "Supporting note"),
      f("last_verified_at", "Claim review date", { kind: "date" }),
      ...(key === "types"
        ? [f("is_primary", "Primary type", { kind: "boolean", required: true })]
        : []),
    ],
  })),
];
export const HOURS_FIELDS: Field[] = [
  f("day", "Day", {
    required: true,
    choices: [
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday",
      "sunday",
    ],
  }),
  f("opens", "Opens", { hint: "24-hour HH:MM" }),
  f("closes", "Closes"),
  f("closed", "Closed", { kind: "boolean" }),
  f("note", "Hours note"),
];
export const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function object(v: unknown): Record<string, unknown> {
  if (!v || typeof v !== "object" || Array.isArray(v))
    throw Error("Invalid contract");
  return v as Record<string, unknown>;
}
function rows(v: unknown): unknown[] {
  if (!Array.isArray(v) || v.length > 100) throw Error("Invalid contract");
  return v;
}
function text(v: unknown): string {
  if (typeof v !== "string" || !v.trim() || v.length > 4000)
    throw Error("Invalid contract");
  return v;
}
export function fields(
  value: unknown,
  spec: Field[],
  extras: string[] = [],
): Row {
  const r = object(value),
    result: Row = {};
  if (
    Object.keys(r).some(
      (k) => !spec.some((f) => f.key === k) && !extras.includes(k),
    )
  )
    throw Error("Invalid field");
  for (const f of spec) {
    const v = r[f.key];
    if (v === undefined || v === null) {
      if (f.required) throw Error("Missing field");
      result[f.key] = null;
      continue;
    }
    if (f.kind === "number") {
      if (typeof v !== "number" || !Number.isFinite(v))
        throw Error("Invalid number");
      result[f.key] = v;
    } else if (f.kind === "boolean") {
      if (typeof v !== "boolean") throw Error("Invalid boolean");
      result[f.key] = v;
    } else if (f.kind === "claims") result[f.key] = rows(v).map(text);
    else {
      const t = text(v);
      if (f.choices && !f.choices.includes(t)) throw Error("Invalid choice");
      if (f.vocabulary && !UUID.test(t)) throw Error("Invalid ID");
      if (
        f.kind === "date" &&
        (!/^\d{4}-\d{2}-\d{2}/.test(t) || !Number.isFinite(Date.parse(t)))
      )
        throw Error("Invalid date");
      result[f.key] = t;
    }
  }
  return result;
}
export function document(value: unknown): Document {
  const d = object(value);
  if (
    Object.keys(d).some((k) => k !== "shop" && !GROUPS.some((g) => g.key === k))
  )
    throw Error("Invalid document");
  const shop = fields(d.shop, SHOP_FIELDS, ["opening_hours"]);
  const hours = object(d.shop).opening_hours;
  shop.opening_hours = null;
  if (hours !== null && hours !== undefined) {
    const h = object(hours);
    if (Object.keys(h).some((k) => k !== "entries" && k !== "note"))
      throw Error("Invalid hours");
    shop.opening_hours = {
      ...(h.note ? { note: text(h.note) } : {}),
      ...(h.entries
        ? { entries: rows(h.entries).map((r) => fields(r, HOURS_FIELDS)) }
        : {}),
    };
  }
  const result = { shop } as Document;
  for (const g of GROUPS) {
    result[g.key] = rows(g.key === "experiences" ? d[g.key] ?? [] : d[g.key]).map((value) => {
      const r = object(value),
        item = fields(r, g.fields, ["id"]);
      if (["sources", "aliases", "links", "experiences"].includes(g.key)) {
        if (typeof r.id !== "string" || !UUID.test(r.id))
          throw Error("Invalid ID");
        item.id = r.id;
      } else if (r.id !== undefined) throw Error("Invalid field");
      return item;
    });
  }
  return result;
}
export function decodeShop(value: unknown): ShopRecord {
  const r = object(value),
    id = text(r.id),
    revision = text(r.revision),
    publicationStatus = text(r.publicationStatus);
  if (
    !UUID.test(id) ||
    !/^([a-f0-9]{32}|[a-f0-9-]{36})$/i.test(revision) ||
    !["draft", "published", "archived"].includes(publicationStatus) ||
    typeof r.hasChanges !== "boolean"
  )
    throw Error("Invalid shop");
  return {
    id,
    revision,
    publicationStatus,
    hasChanges: r.hasChanges,
    positionConfirmed: r.positionConfirmed === true,
    document: document(r.document),
    publicationErrors: rows(r.publicationErrors).map(text),
  };
}
export function decodeList(value: unknown): ShopSummary[] {
  return rows(value).map((value) => {
    const r = object(value),
      id = text(r.id);
    if (!UUID.test(id) || typeof r.hasChanges !== "boolean")
      throw Error("Invalid shop");
    return {
      id,
      name: text(r.name),
      slug: text(r.slug),
      publicationStatus: text(r.publicationStatus),
      operationalStatus: text(r.operationalStatus),
      hasChanges: r.hasChanges,
    };
  });
}
export function decodeOptions(value: unknown): Options {
  const r = object(value),
    output: Options = {};
  for (const k of [
    "localities",
    "types",
    "services",
    "specialties",
    "brands",
  ]) {
    if (!Array.isArray(r[k]) || (r[k] as unknown[]).length > 10000)
      throw Error("Invalid options");
    output[k] = (r[k] as unknown[]).map((v) => {
      const o = object(v),
        id = text(o.id);
      if (!UUID.test(id)) throw Error("Invalid ID");
      return {
        id,
        label: text(o.label),
        ...(k === "localities" ? { countryCode: text(o.countryCode) } : {}),
      };
    });
  }
  return output;
}
