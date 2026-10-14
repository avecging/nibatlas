import type { ShopMedia } from "@/src/features/admin/media-contract";

/**
 * How the public shop surface reads one media list.
 *
 * The published list is read once per shop and split here, rather than in each
 * component that needs part of it: the identity header wants the business's
 * logo, the gallery wants the photographs, and issue #82's stack came from a
 * renderer that treated both as the same thing.
 *
 * Nothing sorts. `docs/api/admin-media-v1.md` orders the public list by
 * `sort_order, created_at, id`, so server order *is* the founder's chosen
 * arrangement and the first published photo is the public cover.
 */
export interface ShopMediaSplit {
  /** The business's own mark. Never a gallery photo, and never counted as one. */
  readonly logo: ShopMedia | null;
  /** Published photographs, in server order. The first is the public cover. */
  readonly photos: readonly ShopMedia[];
}

export function splitShopMedia(entries: readonly ShopMedia[]): ShopMediaSplit {
  return {
    logo: entries.find((entry) => entry.kind === "logo") ?? null,
    photos: entries.filter((entry) => entry.kind === "photo"),
  };
}

/**
 * Whether a logo is drawn in the square slot or the wide one.
 *
 * PR #81 keeps a wide mark's real proportions through intake, and the intrinsic
 * `width`/`height` the media contract already carries are enough to choose a
 * slot here — there is no "logo shape" field to add. A mark is wide once it is
 * meaningfully wider than tall; everything else, including a portrait mark, gets
 * the square slot, where `object-fit: contain` leaves it whole either way.
 */
export const WIDE_LOGO_ASPECT_RATIO = 1.4;

export type LogoShape = "square" | "wide";

export function logoShape(logo: Pick<ShopMedia, "width" | "height">): LogoShape {
  return logo.width >= logo.height * WIDE_LOGO_ASPECT_RATIO ? "wide" : "square";
}
