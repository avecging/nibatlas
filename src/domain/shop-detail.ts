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

/**
 * How a service is reached.
 *
 * `docs/milestone-1-5-product-refinement.md` root cause D: a repair bench and a
 * shelf of boxed pens are the same row in a general directory, and the thing
 * that separates them is whether you can walk in, have to book, or have to post
 * the pen. The mode is therefore part of the claim rather than prose around it.
 */
export type ServiceAccessMode = "walk_in" | "booking" | "send_in" | "enquire";

export const SERVICE_ACCESS_MODE_LABELS: Record<ServiceAccessMode, string> = {
  walk_in: "Walk-in",
  booking: "Booking",
  send_in: "Send-in",
  enquire: "Ask in store",
};

/**
 * A claim that names the source backing it.
 *
 * `confirmedBy` holds the `label` of one of the record's own {@link ShopSourceRef}
 * entries — the evidence registry that already exists — so a pen-specific claim
 * cannot be written without pointing at the source it came from.
 *
 * Naming the source is necessary but not sufficient. `shopEvidenceIssues` in
 * `src/domain/shop-evidence.ts` also requires the named source's own `confirms`
 * list to cover *this* claim: a service may not lean on a source that confirms
 * only a shop's local-script name, and one confirmed field of an access or
 * practical block never validates another. See that module for the rule and the
 * evidence tokens it compares.
 *
 * This is the mechanism accepted decision 4 asks for: Claude Code may define the
 * optional schema, and must never invent services, experiences, exclusives, or
 * practical details.
 */
export interface SourcedClaim {
  /** `ShopSourceRef.label` of the source that confirms this claim. */
  readonly confirmedBy: string;
}

/**
 * One practical fact, with the source that confirms *it*.
 *
 * Access and practical facts are sourced per field rather than per block. A
 * block-level reference would let one source that publishes a station implicitly
 * vouch for a payment method and a spoken language it says nothing about, which
 * is exactly the hole the first WP4 attempt left open — a check alone would have
 * caught it, but the type now makes it unsayable.
 */
export interface SourcedText extends SourcedClaim {
  readonly value: string;
}

export interface SourcedList extends SourcedClaim {
  readonly values: readonly string[];
}

export interface SourcedFlag extends SourcedClaim {
  readonly value: boolean;
}

/** Something a visitor can have done to a pen, with how it is reached. */
export interface ShopService extends SourcedClaim {
  readonly label: string;
  readonly accessMode?: ServiceAccessMode;
  /** As the source states it: `~30 min`, `3–5 days`. Never estimated here. */
  readonly duration?: string;
  readonly note?: string;
}

/** Something a visitor can do in the shop: a test bench, an ink wall, a clinic. */
export interface ShopExperience extends SourcedClaim {
  readonly label: string;
  readonly detail?: string;
  readonly bookingRequired?: boolean;
}

/** The reason a pen traveller detours: shop-only inks, house editions. */
export interface ShopExclusive extends SourcedClaim {
  readonly label: string;
  readonly detail?: string;
}

/**
 * Getting in.
 *
 * The two practical facts a general listing never carries: which station you
 * walk from, and the building or floor note that decides whether you find the
 * door at all. Each carries its own source.
 */
export interface ShopAccessNote {
  readonly nearestStation?: SourcedText;
  /** Walking guidance exactly as the source words it. Never computed. */
  readonly walkFromStation?: SourcedText;
  readonly floorNote?: SourcedText;
  readonly accessibilityNote?: SourcedText;
}

/** Practical facts that decide whether a visit works: payment, language, booking. */
export interface ShopPracticalInfo {
  readonly paymentMethods?: SourcedList;
  readonly languages?: SourcedList;
  readonly appointmentRequired?: SourcedFlag;
}

export interface ShopDetail extends ShopMapSummary {
  /** One or two sourced sentences on why the shop may be worth a visit. */
  readonly shortDescription?: string;
  readonly addressLines?: readonly string[];
  readonly neighbourhood?: string;
  readonly timezone: string;
  readonly shopTypes: readonly ShopType[];
  readonly specialties?: readonly string[];
  /**
   * What you can do there.
   *
   * WP4 replaces the plain `readonly string[]` this field carried in Milestone 1.
   * A bare label cannot say whether a nib grind is a walk-in or a three-day
   * send-in, which is the distinction the whole section exists to make. Nothing
   * populated the string form, so nothing was migrated.
   */
  readonly services?: readonly ShopService[];
  readonly experiences?: readonly ShopExperience[];
  readonly exclusives?: readonly ShopExclusive[];
  readonly access?: ShopAccessNote;
  readonly practical?: ShopPracticalInfo;
  readonly brands?: readonly string[];
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
