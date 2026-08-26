import type { CountryCode } from "@/src/domain/geo";
import type { ShopMapSummary, ShopType } from "@/src/domain/shops";
import type { StampInk } from "@/src/domain/stamp-palette";

/**
 * Additive frontend projection for the shop detail surface.
 *
 * `ShopMapSummary` stays the shared marker/card contract owned with Codex.
 * `ShopDetail` extends it without altering it so that Milestone 3 can supply the
 * same shape from `GET /api/v1/shops/[slug]`.
 *
 * Almost every field is optional on purpose. The Milestone 1 catalogue holds a
 * small subset of real shops, and a field that no source supports is left out
 * rather than filled with something plausible. The detail view renders whatever
 * is present and says nothing at all about what is absent.
 */
export type OpeningHoursDay =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday";

export type OpeningHoursEntry = {
  readonly day: OpeningHoursDay;
  readonly opens?: string;
  readonly closes?: string;
  readonly closed?: boolean;
  readonly note?: string;
};

export interface ShopLink {
  readonly label: string;
  readonly url: string;
  readonly isOfficial: boolean;
}

/**
 * Where a record's facts came from.
 *
 * Every prototype shop carries at least one. `confirms` names the fields the
 * source actually supports, so a reviewer can tell a shop whose address came
 * from its own website from one whose locality came from a community list.
 */
export interface ShopSourceRef {
  readonly label: string;
  readonly url?: string;
  /** ISO date the source was read, so freshness is never implied. */
  readonly retrievedOn: string;
  readonly kind: "official" | "brand_dealer_list" | "community_list" | "founder_visit";
  readonly confirms: readonly string[];
}

/**
 * How precise the mapped coordinate is.
 *
 * No coordinate in the Milestone 1 catalogue is surveyed. `street` means the
 * point was placed from a sourced street address, `locality` means only the
 * locality is known. Both are shown as approximate in the interface; the
 * distinction exists so Milestone 7 knows what still needs field verification.
 */
export type PositionPrecision = "street" | "locality";

export interface ShopDetail extends ShopMapSummary {
  /** One or two sourced sentences on why the shop may be worth a visit. */
  readonly shortDescription?: string;
  readonly addressLines?: readonly string[];
  readonly neighbourhood?: string;
  readonly timezone: string;
  readonly shopTypes: readonly ShopType[];
  readonly specialties?: readonly string[];
  readonly services?: readonly string[];
  readonly brands?: readonly string[];
  readonly appointmentRequired?: boolean;
  readonly accessibilityNotes?: string;
  readonly openingHours?: readonly OpeningHoursEntry[];
  readonly openingHoursNote?: string;
  readonly links?: readonly ShopLink[];
  readonly positionPrecision: PositionPrecision;
  readonly sources: readonly ShopSourceRef[];
  readonly stamp: ShopStampDesign;
}

/**
 * A stamp's generated design.
 *
 * `tier` changes the frame anatomy only. Ink is chosen from the shared global
 * palette by `inkForStampKey` and carries no country, locality, tier, or rarity
 * meaning; `paletteVersion` pins the palette so the impression regenerates
 * identically later.
 */
export type StampTier = "shop" | "locality" | "country";

export interface ShopStampDesign {
  readonly id: string;
  readonly tier: StampTier;
  readonly motif: StampMotif;
  readonly ink: StampInk;
  readonly localityLabel: string;
  readonly countryLabel: string;
  readonly designVersion: number;
  readonly paletteVersion: number;
}

/**
 * Motifs are drawn from stationery culture and generic street architecture, not
 * from national symbols. `BRAND.md` forbids applying one country's iconography
 * to another, so nothing here is country-specific: the catalogue picks a motif
 * per shop from what the shop itself is.
 */
export type StampMotif =
  | "storefront"
  | "shophouse"
  | "ink-bottle"
  | "nib"
  | "arcade"
  | "harbour"
  | "counter"
  | "workbench";

export const COUNTRY_LABELS: Record<CountryCode, string> = {
  SG: "Singapore",
  JP: "Japan",
  TW: "Taiwan",
};

export const SHOP_TYPE_LABELS: Record<ShopType, string> = {
  fountain_pen_specialist: "Fountain Pen Specialist",
  stationery_store: "Stationery Store",
  vintage_used: "Vintage / Used",
  nib_repair_services: "Nib / Repair Services",
};

export const OPERATIONAL_STATUS_LABELS = {
  open: "Open",
  temporarily_closed: "Temporarily closed",
  permanently_closed: "Permanently closed",
  unknown: "Status not confirmed",
} as const;

export const SOURCE_KIND_LABELS: Record<ShopSourceRef["kind"], string> = {
  official: "Shop's own website",
  brand_dealer_list: "Brand dealer listing",
  community_list: "Community shop list",
  founder_visit: "Founder visit note",
};

export const POSITION_PRECISION_LABELS: Record<PositionPrecision, string> = {
  street: "Approximate, placed from a sourced street address",
  locality: "Approximate, locality only",
};
