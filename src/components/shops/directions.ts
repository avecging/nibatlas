import type { ShopDetail } from "@/src/domain/shop-detail";

/**
 * Native map directions.
 *
 * `docs/milestone-1-5-product-refinement.md` settles this: "Directions open the
 * platform's own maps application", and Nib Atlas never embeds an itinerary
 * feature. So the href is chosen from the platform rather than always pointing
 * at a web map:
 *
 * - **iOS / macOS** — an Apple Maps universal link, which the operating system
 *   hands to the Maps application.
 * - **Android** — the `geo:` intent, which opens the device's own map chooser.
 * - **anything else** — OpenStreetMap's directions page, keeping the provider
 *   Milestone 1 already used rather than introducing a new third party on
 *   desktop, where there is no native application to hand off to.
 *
 * Only the destination travels. No user position is read, sent, or stored, which
 * is the invariant the Collect Stamp preflight is also written around.
 */
export type MapPlatform = "ios" | "android" | "other";

/**
 * Reads the platform from a user-agent string.
 *
 * Pure, and takes the string rather than touching `navigator`, so the mapping is
 * unit-testable and the component can resolve it after mount without the server
 * and the client disagreeing on the first render.
 */
export function detectMapPlatform(userAgent: string | undefined): MapPlatform {
  if (userAgent === undefined || userAgent === "") {
    return "other";
  }

  const agent = userAgent.toLowerCase();

  // Android before iOS: several Android browsers put "Mobile Safari" in the
  // string, but only Apple platforms carry iPhone/iPad/Macintosh.
  if (agent.includes("android")) {
    return "android";
  }

  if (/iphone|ipad|ipod|macintosh|mac os x/.test(agent)) {
    return "ios";
  }

  return "other";
}

export function directionsHref(shop: ShopDetail, platform: MapPlatform): string {
  const { latitude, longitude } = shop.position;
  const point = `${latitude},${longitude}`;

  if (platform === "ios") {
    // `dirflg=w` asks for walking, which is how a pen shop crawl is actually
    // done; Maps falls back to its own default when walking is unavailable.
    return `https://maps.apple.com/?daddr=${encodeURIComponent(point)}&dirflg=w`;
  }

  if (platform === "android") {
    // `q=` carries the label so the chooser shows the shop's name rather than a
    // bare coordinate.
    return `geo:${point}?q=${encodeURIComponent(point)}(${encodeURIComponent(shop.name)})`;
  }

  return `https://www.openstreetmap.org/directions?to=${encodeURIComponent(point)}`;
}
