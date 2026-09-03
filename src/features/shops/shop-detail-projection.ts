import { countryLabel } from "@/src/domain/geo";
import type { ShopDetailReadV1 } from "@/src/api/v1/shop-read";
import type {
  ShopDetail,
  ShopLink,
  ShopStampDesign,
} from "@/src/domain/shop-detail";
import { motifForStampKey, STAMP_DESIGN_VERSION } from "@/src/domain/stamp-design";
import { inkForStampKey, STAMP_PALETTE_VERSION } from "@/src/domain/stamp-palette";

/**
 * The one adapter step between the v1 wire detail and the frontend `ShopDetail`.
 *
 * `docs/api/v1-shop-reads.md` states the detail projection is deliberately one
 * step short of the frontend type: Milestone 3 adds the frontend-owned stamp
 * design and maps the remaining presentation fields. This is that step, and it
 * is the *only* place a wire detail becomes domain state.
 *
 * It fails closed rather than trimming fields that belong to the public wire
 * contract. Where the wire carries something the domain model cannot represent
 * honestly — a demo record outside a demo-accepting mode or a link whose URL
 * will not parse — the whole detail is rejected and the page says the detail is
 * unavailable.
 */
export class ShopDetailProjectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ShopDetailProjectionError";
  }
}

export interface ShopDetailProjectionOptions {
  /**
   * Whether demo-quality staging records are acceptable in this mode. See
   * `CatalogueModeResolution.demoRecords`.
   */
  readonly demoRecords: boolean;
}

function linkLabel(url: string, label: string | undefined): string {
  if (label !== undefined && label.trim() !== "") {
    return label;
  }

  // Not invention: the host is part of the URL the record already carries. A URL
  // that will not parse cannot be labelled or trusted, so it fails closed.
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    throw new ShopDetailProjectionError(`detail.links contains an unparseable URL`);
  }
}

/**
 * The frontend-owned stamp design for an API-backed record.
 *
 * Ink and motif are both chosen blind from the stamp key, so nothing about the
 * country, locality, or shop type can accumulate meaning in the art, and the
 * same shop regenerates the same impression on the server and the client.
 */
export function projectStampDesign(shop: {
  readonly slug: string;
  readonly localityName: string;
  readonly countryCode: Parameters<typeof countryLabel>[0];
}): ShopStampDesign {
  const key = `stamp-${shop.slug}`;

  return {
    id: key,
    tier: "shop",
    motif: motifForStampKey(key),
    ink: inkForStampKey(key),
    localityLabel: shop.localityName,
    countryLabel: countryLabel(shop.countryCode),
    designVersion: STAMP_DESIGN_VERSION,
    paletteVersion: STAMP_PALETTE_VERSION,
  };
}

export function projectShopDetail(
  wire: ShopDetailReadV1,
  { demoRecords }: ShopDetailProjectionOptions,
): ShopDetail {
  const demoSources = wire.sources.filter((source) => source.kind === "demo_fixture");

  if (demoSources.length > 0 && wire.sourceQuality !== "demo") {
    throw new ShopDetailProjectionError(
      "detail.sources uses demo_fixture on a record that is not demo quality",
    );
  }

  if (wire.sourceQuality === "demo") {
    if (!demoRecords) {
      throw new ShopDetailProjectionError(
        "detail is a demo-quality record outside a demo-accepting catalogue mode",
      );
    }

    // A demo record has to arrive already marked as one. `DATA-MODEL.md` and
    // `AGENTS.md` both require invented data to be visibly fixture data, and
    // this projection is not allowed to write that notice on the record's
    // behalf — the catalogue either says it or the page does not publish it.
    if (wire.fixtureNotice === undefined || wire.fixtureNotice.trim() === "") {
      throw new ShopDetailProjectionError(
        "detail is demo quality but carries no fixture notice",
      );
    }
  }

  const wireLinks: readonly ShopLink[] = wire.links.map((link) => ({
    label: linkLabel(link.url, link.label),
    url: link.url,
    isOfficial: link.isOfficial,
  }));

  /*
   * `websiteUrl` is the record's own site and belongs in the same contextual
   * link list the fixtures populate, so it is folded in rather than dropped —
   * deduplicated, because a record may already list it among `links`.
   *
   * Three wire fields have no Milestone 3 presentation home and are therefore
   * carried nowhere: `phone`, `postalCode`, and `lastVerifiedAt`. Their absence
   * asserts nothing — the detail page omits unsupported fields in silence by
   * design — and appending a postal code to an address the source published as
   * it stands would change that address. All three are recorded as open
   * presentation questions in the WP2 pull request rather than invented into a
   * section of their own.
   */
  const hasWebsiteLink =
    wire.websiteUrl !== undefined &&
    wireLinks.some((link) => link.url === wire.websiteUrl);
  const links: readonly ShopLink[] =
    wire.websiteUrl === undefined || hasWebsiteLink
      ? wireLinks
      : [
          ...wireLinks,
          {
            label: linkLabel(wire.websiteUrl, undefined),
            url: wire.websiteUrl,
            isOfficial: true,
          },
        ];

  return {
    id: wire.id,
    slug: wire.slug,
    name: wire.name,
    ...(wire.localName === undefined
      ? {}
      : {
          localName: wire.localName,
          ...(wire.localNameLang === undefined ? {} : { localNameLang: wire.localNameLang }),
        }),
    countryCode: wire.countryCode,
    localityName: wire.localityName,
    position: wire.position,
    primaryType: wire.primaryType,
    specialtyLine: wire.specialtyLine,
    operationalStatus: wire.operationalStatus,
    // Public catalogue responses always begin unvisited. Device-local saved and
    // visited state is merged for display only, never read back into the record.
    markerState: "unvisited",
    sourceQuality: wire.sourceQuality,
    ...(wire.fixtureNotice === undefined ? {} : { fixtureNotice: wire.fixtureNotice }),
    ...(wire.shortDescription === undefined
      ? {}
      : { shortDescription: wire.shortDescription }),
    ...(wire.addressLines === undefined || wire.addressLines.length === 0
      ? {}
      : { addressLines: wire.addressLines }),
    ...(wire.neighbourhood === undefined ? {} : { neighbourhood: wire.neighbourhood }),
    timezone: wire.timezone,
    shopTypes: wire.shopTypes.length === 0 ? [wire.primaryType] : wire.shopTypes,
    ...(wire.specialties.length === 0 ? {} : { specialties: wire.specialties }),
    ...(wire.services.length === 0 ? {} : { services: wire.services }),
    ...(wire.brands.length === 0 ? {} : { brands: wire.brands }),
    ...(wire.openingHours === undefined || wire.openingHours.length === 0
      ? {}
      : { openingHours: wire.openingHours }),
    ...(wire.openingHoursNote === undefined
      ? {}
      : { openingHoursNote: wire.openingHoursNote }),
    ...(links.length === 0 ? {} : { links }),
    positionPrecision: wire.positionPrecision,
    sources: wire.sources,
    stamp: projectStampDesign(wire),
  };
}
