import type { CountryCode } from "@/src/domain/geo";
import type { ShopMapSummary, ShopType } from "@/src/domain/shops";

/**
 * Additive frontend projection for the shop detail surface.
 *
 * `ShopMapSummary` stays the shared marker/card contract owned with Codex.
 * `ShopDetail` extends it without altering it so that Milestone 3 can supply the
 * same shape from `/api/v1/shops/[slug]` behind the existing adapter seam.
 */
export type OpeningHoursEntry = {
  readonly day:
    | "monday"
    | "tuesday"
    | "wednesday"
    | "thursday"
    | "friday"
    | "saturday"
    | "sunday";
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

export interface ShopProvenance {
  readonly lastVerifiedAt: string | null;
  readonly summary: string;
}

export interface ShopDetail extends ShopMapSummary {
  readonly shortDescription: string;
  readonly addressLines: readonly string[];
  readonly neighbourhood?: string;
  readonly timezone: string;
  readonly shopTypes: readonly ShopType[];
  readonly specialties: readonly string[];
  readonly services: readonly string[];
  readonly brands: readonly string[];
  readonly appointmentRequired: boolean;
  readonly accessibilityNotes?: string;
  readonly openingHours: readonly OpeningHoursEntry[];
  readonly openingHoursNote?: string;
  readonly links: readonly ShopLink[];
  readonly provenance: ShopProvenance;
  readonly stamp: ShopStampDesign;
}

export interface ShopStampDesign {
  readonly id: string;
  readonly motif: StampMotif;
  readonly ink: StampInk;
  readonly localityLabel: string;
  readonly countryLabel: string;
  readonly designVersion: number;
}

export type StampMotif =
  | "harbour-city"
  | "shophouse"
  | "torii-street"
  | "castle-town"
  | "mountain-pass"
  | "temple-lane"
  | "island-coast"
  | "market-arcade";

export type StampInk = "vermilion" | "indigo" | "teal";

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
  unknown: "Hours unknown",
} as const;
