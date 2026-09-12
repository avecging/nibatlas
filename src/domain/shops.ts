import type { CountryCode, GeoPoint, ViewportBounds } from "@/src/domain/geo";
import type { LanguageTag } from "@/src/domain/language";

export const SHOP_TYPES = [
  "fountain_pen_specialist",
  "stationery_store",
  "vintage_used",
  "nib_repair_services",
] as const;

// Test venues are renderable records, never a public pen-shop filter.
export const SHOP_RECORD_TYPES = [...SHOP_TYPES, "test_venue"] as const;
export type ShopType = (typeof SHOP_RECORD_TYPES)[number];
export type OperationalStatus =
  | "open"
  | "temporarily_closed"
  | "permanently_closed"
  | "unknown";
export type MarkerState = "unvisited" | "saved" | "visited";
export type SourceQuality = "verified" | "sourced" | "community_unverified" | "demo";

export interface ShopMapSummary {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly localName?: string;
  /** BCP 47 tag for `localName`; never inferred from country. */
  readonly localNameLang?: LanguageTag;
  readonly countryCode: CountryCode;
  readonly localityName: string;
  readonly position: GeoPoint;
  readonly primaryType: ShopType;
  /** One visit-oriented specialty or service for compact map/list cards. */
  readonly specialtyLine: string | null;
  readonly operationalStatus: OperationalStatus;
  readonly markerState: MarkerState;
  readonly sourceQuality: SourceQuality;
  readonly fixtureNotice?: string;
}

export interface ViewportShopRequest {
  readonly bounds: ViewportBounds;
  readonly zoom: number;
  /** Public catalogue filter sent to the read API. */
  readonly operationalStatuses?: readonly OperationalStatus[];
  /** Prototype user-state filter; never sent as a public catalogue filter. */
  readonly statuses?: readonly MarkerState[];
  readonly shopTypes?: readonly ShopType[];
  readonly limit?: number;
}

export interface ViewportShopResponse {
  readonly shops: readonly ShopMapSummary[];
  readonly truncated: boolean;
  readonly committedBounds: ViewportBounds;
}
