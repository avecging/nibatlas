import type { CountryCode, GeoPoint, ViewportBounds } from "@/src/domain/geo";

export const SHOP_TYPES = [
  "fountain_pen_specialist",
  "stationery_store",
  "vintage_used",
  "nib_repair_services",
] as const;

export type ShopType = (typeof SHOP_TYPES)[number];
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
  readonly countryCode: CountryCode;
  readonly localityName: string;
  readonly position: GeoPoint;
  readonly primaryType: ShopType;
  readonly operationalStatus: OperationalStatus;
  readonly markerState: MarkerState;
  readonly sourceQuality: SourceQuality;
  readonly fixtureNotice?: string;
}

export interface ViewportShopRequest {
  readonly bounds: ViewportBounds;
  readonly zoom: number;
  readonly statuses?: readonly MarkerState[];
  readonly shopTypes?: readonly ShopType[];
  readonly limit?: number;
}

export interface ViewportShopResponse {
  readonly shops: readonly ShopMapSummary[];
  readonly truncated: boolean;
  readonly committedBounds: ViewportBounds;
}
