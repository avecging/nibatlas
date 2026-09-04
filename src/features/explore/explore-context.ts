import {
  AVAILABILITY_FILTERS,
  EMPTY_FILTERS,
  STATUS_FILTERS,
  type ShopFilters,
} from "@/src/domain/filters";
import type { Viewport } from "@/src/domain/geo";
import { SHOP_TYPES } from "@/src/domain/shops";

export const EXPLORE_CONTEXT_PARAM = "mapContext";
export const EXPLORE_CONTEXT_STORAGE_KEY = "nib-atlas.explore-viewport.v1";

export interface ExploreContext {
  readonly viewport: Viewport;
  readonly label: string | null;
  readonly filters: ShopFilters;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function parseViewport(value: unknown): Viewport | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const viewport = value as Record<string, unknown>;
  const bounds = viewport["bounds"];

  if (!bounds || typeof bounds !== "object") {
    return null;
  }

  const record = bounds as Record<string, unknown>;
  const west = record["west"];
  const south = record["south"];
  const east = record["east"];
  const north = record["north"];
  const zoom = viewport["zoom"];

  if (
    !isFiniteNumber(west) ||
    !isFiniteNumber(south) ||
    !isFiniteNumber(east) ||
    !isFiniteNumber(north) ||
    !isFiniteNumber(zoom) ||
    west < -540 ||
    west > 540 ||
    east < -540 ||
    east > 540 ||
    south < -90 ||
    north > 90 ||
    south >= north ||
    Math.abs(east - west) > 360 ||
    zoom < 0 ||
    zoom > 24
  ) {
    return null;
  }

  return { bounds: { west, south, east, north }, zoom };
}

function parseFilters(value: unknown): ShopFilters | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const filters = value as Record<string, unknown>;
  const status = filters["status"];
  const availability = filters["availability"];
  const shopTypes = filters["shopTypes"];

  if (
    typeof status !== "string" ||
    !STATUS_FILTERS.includes(status as (typeof STATUS_FILTERS)[number]) ||
    typeof availability !== "string" ||
    !AVAILABILITY_FILTERS.includes(
      availability as (typeof AVAILABILITY_FILTERS)[number],
    ) ||
    !Array.isArray(shopTypes) ||
    shopTypes.some(
      (shopType) =>
        typeof shopType !== "string" ||
        !SHOP_TYPES.includes(shopType as (typeof SHOP_TYPES)[number]),
    )
  ) {
    return null;
  }

  return {
    status: status as ShopFilters["status"],
    availability: availability as ShopFilters["availability"],
    shopTypes: SHOP_TYPES.filter((shopType) => shopTypes.includes(shopType)),
  };
}

/** Reads either the current record or the viewport-only record written before WP3. */
export function parseExploreContext(value: unknown): ExploreContext | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  const viewport = parseViewport(record["viewport"]);
  const filters = record["filters"] === undefined
    ? EMPTY_FILTERS
    : parseFilters(record["filters"]);
  const label = record["label"];

  if (!viewport || !filters || (label !== null && typeof label !== "string")) {
    return null;
  }

  return {
    viewport,
    filters,
    label: typeof label === "string" ? label.slice(0, 120) : null,
  };
}

export function readPersistedExploreContext(): ExploreContext | null {
  try {
    const raw = window.sessionStorage.getItem(EXPLORE_CONTEXT_STORAGE_KEY);
    return raw ? parseExploreContext(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

export function encodeExploreContext(context: ExploreContext): string {
  return JSON.stringify(context);
}

export function decodeExploreContext(value: string | null | undefined): ExploreContext | null {
  if (!value || value.length > 1_500) {
    return null;
  }

  try {
    return parseExploreContext(JSON.parse(value));
  } catch {
    return null;
  }
}

/** Adds the last committed map state to a map or shop return path. */
export function withExploreContext(returnTo: string): string {
  if (typeof window === "undefined") {
    return returnTo;
  }

  const context = readPersistedExploreContext();

  if (!context) {
    return returnTo;
  }

  const url = new URL(returnTo, "https://nibatlas.invalid");

  if (url.pathname !== "/" && !url.pathname.startsWith("/shops/")) {
    return returnTo;
  }

  url.searchParams.set(EXPLORE_CONTEXT_PARAM, encodeExploreContext(context));
  return `${url.pathname}${url.search}${url.hash}`;
}
