import type { CountryCode } from "@/src/domain/geo";
import type { CountryCoverageSet, SealDesignInput } from "@/src/domain/seals";
import type {
  OpeningHoursEntry,
  PositionPrecision,
  ShopDetail,
  ShopLink,
  ShopSourceRef,
  ShopStampDesign,
  StampMotif,
} from "@/src/domain/shop-detail";
import { COUNTRY_LABELS } from "@/src/domain/shop-detail";
import type {
  OperationalStatus,
  ShopMapSummary,
  ShopType,
  SourceQuality,
} from "@/src/domain/shops";
import { inkForStampKey, STAMP_PALETTE_VERSION } from "@/src/domain/stamp-palette";

/**
 * Milestone 1 prototype catalogue.
 *
 * These are real shops, deliberately few, and every fact below traces to the
 * `sources` entry that supports it. The rules this file follows, from
 * `docs/milestone-1-prototype-acceptance.md`:
 *
 * - reuse only source-supported names, local-script names, locations,
 *   categories, links, and practical details;
 * - omit an uncertain field rather than invent a realistic-looking one;
 * - never present the catalogue as complete or continuously verified.
 *
 * What is deliberately missing, everywhere: photographs (no rights are cleared),
 * telephone numbers, prices, stock, ratings, and any opening hours or address not
 * published by the shop itself or by a brand's own dealer directory.
 *
 * Coordinates are the one unavoidable approximation. A map prototype needs a
 * point, and none of these points is surveyed, so each record states its
 * precision and the interface labels every position as approximate. Milestone 7
 * replaces them with verified coordinates.
 */
export const PROTOTYPE_CATALOGUE_NOTICE =
  "Prototype catalogue — a small sourced subset, not a complete or continuously verified listing";

export const PROTOTYPE_DESIGN_VERSION = 1;

const TIMEZONES: Record<CountryCode, string> = {
  SG: "Asia/Singapore",
  JP: "Asia/Tokyo",
  TW: "Asia/Taipei",
};

/* --------------------------------------------------------------------------
 * Sources
 * ----------------------------------------------------------------------- */

const RETRIEVED = "2026-08-26";

const SOURCES = {
  aestheticBay: {
    label: "aestheticbay.com — Aesthetic Bay's own website",
    url: "https://www.aestheticbay.com/",
    retrievedOn: RETRIEVED,
    kind: "official",
    confirms: ["Name", "Address", "Brands carried", "Shop type"],
  },
  sailorDealers: {
    label: "sailorpen.com — Sailor's own dealer directory",
    url: "https://sailorpen.com/dealer/fook-hing-trading-co/",
    retrievedOn: RETRIEVED,
    kind: "brand_dealer_list",
    confirms: ["Name", "Address", "Opening hours", "Sailor stockist"],
  },
  itoya: {
    label: "ito-ya.co.jp — Itoya's own store directory",
    url: "https://www.ito-ya.co.jp/store/index.html",
    retrievedOn: RETRIEVED,
    kind: "official",
    confirms: ["Name", "Local-script name", "Address", "Opening hours", "Founded 1904"],
  },
  nagasawa: {
    label: "kobe-nagasawa.co.jp — NAGASAWA's own store list",
    url: "https://kobe-nagasawa.co.jp/",
    retrievedOn: RETRIEVED,
    kind: "official",
    confirms: ["Name", "Local-script name", "Kobe stores exist"],
  },
  penHouse: {
    label: "penhouse.com.tw — Pen House's own website",
    url: "https://www.penhouse.com.tw/",
    retrievedOn: RETRIEVED,
    kind: "official",
    confirms: ["Local-script name", "Address", "Opening hours", "Brands carried"],
  },
  penHouseDistrict: {
    label: "penguinma.com — community shop write-up naming the district",
    retrievedOn: RETRIEVED,
    kind: "community_list",
    confirms: ["District (East District, Tainan)", "English name Pen House"],
  },
  skb: {
    label: "skb.com.tw — SKB's own website",
    url: "https://www.skb.com.tw/",
    retrievedOn: RETRIEVED,
    kind: "official",
    confirms: ["Local-script name", "Kaohsiung company base", "Taiwanese pen maker"],
  },
  founderTaiwan: {
    label: "Founder field notes and journal photograph, Taiwan, March 2026",
    retrievedOn: "2026-03-16",
    kind: "founder_visit",
    confirms: ["Shop visited", "Locality"],
  },
  tyLee: {
    label: "tylee.tw — TY Lee Pen Shop's own website",
    url: "https://www.tylee.tw/",
    retrievedOn: RETRIEVED,
    kind: "official",
    confirms: ["Local-script name"],
  },
  inkantadora: {
    label: "inkantadora.com — community Taiwan pen and stationery shop list",
    url: "https://www.inkantadora.com/inkantadora/2019/5/27/taiwan-stationery-shopping-list",
    retrievedOn: RETRIEVED,
    kind: "community_list",
    confirms: ["Name", "Address", "District"],
  },
} as const satisfies Record<string, ShopSourceRef>;

/* --------------------------------------------------------------------------
 * Opening hours, only where a source publishes them
 * ----------------------------------------------------------------------- */

const HOURS = {
  /** ito-ya.co.jp: 平日 10:00〜20:00, 日曜・祝日 10:00〜19:00. */
  itoyaGinza: [
    { day: "monday", opens: "10:00", closes: "20:00" },
    { day: "tuesday", opens: "10:00", closes: "20:00" },
    { day: "wednesday", opens: "10:00", closes: "20:00" },
    { day: "thursday", opens: "10:00", closes: "20:00" },
    { day: "friday", opens: "10:00", closes: "20:00" },
    { day: "saturday", opens: "10:00", closes: "20:00" },
    { day: "sunday", opens: "10:00", closes: "19:00" },
  ],
  /** ito-ya.co.jp: 11:00〜19:00, 月曜定休 (open when the Monday is a holiday). */
  itoyaYokohama: [
    { day: "monday", closed: true, note: "Open when the Monday is a public holiday" },
    { day: "tuesday", opens: "11:00", closes: "19:00" },
    { day: "wednesday", opens: "11:00", closes: "19:00" },
    { day: "thursday", opens: "11:00", closes: "19:00" },
    { day: "friday", opens: "11:00", closes: "19:00" },
    { day: "saturday", opens: "11:00", closes: "19:00" },
    { day: "sunday", opens: "11:00", closes: "19:00" },
  ],
  /** penhouse.com.tw: 一至五 10:00-21:00, 六 10:00-18:00, 周日公休. */
  penHouse: [
    { day: "monday", opens: "10:00", closes: "21:00" },
    { day: "tuesday", opens: "10:00", closes: "21:00" },
    { day: "wednesday", opens: "10:00", closes: "21:00" },
    { day: "thursday", opens: "10:00", closes: "21:00" },
    { day: "friday", opens: "10:00", closes: "21:00" },
    { day: "saturday", opens: "10:00", closes: "18:00" },
    { day: "sunday", closed: true },
  ],
  /** sailorpen.com dealer entry: Tuesday–Sunday 10:00–19:30. */
  fookHing: [
    { day: "monday", closed: true },
    { day: "tuesday", opens: "10:00", closes: "19:30" },
    { day: "wednesday", opens: "10:00", closes: "19:30" },
    { day: "thursday", opens: "10:00", closes: "19:30" },
    { day: "friday", opens: "10:00", closes: "19:30" },
    { day: "saturday", opens: "10:00", closes: "19:30" },
    { day: "sunday", opens: "10:00", closes: "19:30" },
  ],
} as const satisfies Record<string, readonly OpeningHoursEntry[]>;

const NO_PUBLISHED_HOURS =
  "No opening hours are published by the shop itself, so none are shown. Confirm before travelling.";

/* --------------------------------------------------------------------------
 * Seeds
 * ----------------------------------------------------------------------- */

interface PrototypeSeed {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly localName?: string;
  readonly countryCode: CountryCode;
  readonly localityName: string;
  readonly localitySlug: string;
  readonly neighbourhood?: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly positionPrecision: PositionPrecision;
  readonly primaryType: ShopType;
  readonly extraTypes?: readonly ShopType[];
  readonly operationalStatus: OperationalStatus;
  readonly sourceQuality: SourceQuality;
  readonly specialtyLine: string | null;
  readonly shortDescription?: string;
  readonly addressLines?: readonly string[];
  readonly openingHours?: readonly OpeningHoursEntry[];
  readonly openingHoursNote?: string;
  readonly brands?: readonly string[];
  readonly links?: readonly ShopLink[];
  readonly motif: StampMotif;
  readonly sources: readonly ShopSourceRef[];
}

const seeds: readonly PrototypeSeed[] = [
  /* ---------------------------- Singapore ---------------------------- */
  {
    id: "shop-sg-aesthetic-bay",
    slug: "aesthetic-bay",
    name: "Aesthetic Bay",
    countryCode: "SG",
    localityName: "Singapore",
    localitySlug: "singapore",
    neighbourhood: "Coleman Street",
    latitude: 1.2925,
    longitude: 103.8506,
    positionPrecision: "street",
    primaryType: "fountain_pen_specialist",
    operationalStatus: "open",
    sourceQuality: "sourced",
    specialtyLine: "Fountain pens, inks and accessories across many brands",
    shortDescription:
      "A long-running Singapore pen boutique carrying fountain pens, inks and accessories from a wide range of international brands.",
    addressLines: ["1 Coleman Street #03-33", "The Adelphi", "Singapore 179803"],
    openingHoursNote: NO_PUBLISHED_HOURS,
    brands: ["Montblanc", "Sailor", "Pilot", "Visconti", "Pelikan"],
    links: [
      { label: "aestheticbay.com", url: "https://www.aestheticbay.com/", isOfficial: true },
    ],
    motif: "counter",
    sources: [SOURCES.aestheticBay],
  },
  {
    id: "shop-sg-fook-hing-trading",
    slug: "fook-hing-trading",
    name: "Fook Hing Trading Co.",
    countryCode: "SG",
    localityName: "Singapore",
    localitySlug: "singapore",
    neighbourhood: "Bras Basah Complex",
    latitude: 1.2971,
    longitude: 103.8524,
    positionPrecision: "street",
    primaryType: "fountain_pen_specialist",
    operationalStatus: "open",
    sourceQuality: "sourced",
    specialtyLine: "Counter inside the Bras Basah book and stationery complex",
    addressLines: ["231 Bain Street #01-23", "Bras Basah Complex", "Singapore 180231"],
    openingHours: HOURS.fookHing,
    openingHoursNote:
      "Hours come from Sailor's dealer directory rather than the shop's own site.",
    brands: ["Sailor"],
    motif: "arcade",
    sources: [SOURCES.sailorDealers],
  },

  /* ------------------------------ Japan ------------------------------ */
  {
    id: "shop-jp-ginza-itoya-main",
    slug: "ginza-itoya-main-store",
    name: "Ginza Itoya Main Store",
    localName: "銀座 伊東屋 本店",
    countryCode: "JP",
    localityName: "Chūō, Tokyo",
    localitySlug: "chuo-tokyo",
    neighbourhood: "Ginza",
    latitude: 35.6721,
    longitude: 139.7669,
    positionPrecision: "street",
    primaryType: "stationery_store",
    operationalStatus: "open",
    sourceQuality: "sourced",
    specialtyLine: "Ginza stationery specialist trading since 1904",
    shortDescription:
      "Itoya's main store, a stationery specialist that has traded in Ginza since 1904.",
    addressLines: ["2-7-15 Ginza, Chūō-ku", "Tokyo 104-0061"],
    openingHours: HOURS.itoyaGinza,
    openingHoursNote: "Public holidays follow the Sunday hours.",
    links: [{ label: "ito-ya.co.jp", url: "https://www.ito-ya.co.jp/", isOfficial: true }],
    motif: "storefront",
    sources: [SOURCES.itoya],
  },
  {
    id: "shop-jp-ginza-itoya-yokohama",
    slug: "ginza-itoya-yokohama-motomachi",
    name: "Ginza Itoya Yokohama Motomachi",
    localName: "銀座 伊東屋 横浜元町",
    countryCode: "JP",
    localityName: "Naka, Yokohama",
    localitySlug: "naka-yokohama",
    neighbourhood: "Motomachi",
    latitude: 35.4425,
    longitude: 139.6432,
    positionPrecision: "street",
    primaryType: "stationery_store",
    operationalStatus: "open",
    sourceQuality: "sourced",
    specialtyLine: "Motomachi shopping-street branch",
    addressLines: ["3-123 Motomachi, Naka-ku", "Yokohama, Kanagawa 231-0861"],
    openingHours: HOURS.itoyaYokohama,
    links: [{ label: "ito-ya.co.jp", url: "https://www.ito-ya.co.jp/", isOfficial: true }],
    motif: "shophouse",
    sources: [SOURCES.itoya],
  },
  {
    id: "shop-jp-nagasawa-main",
    slug: "nagasawa-stationery-center-main-store",
    name: "NAGASAWA Stationery Center Main Store",
    localName: "ナガサワ文具センター 本店",
    countryCode: "JP",
    localityName: "Kobe",
    localitySlug: "kobe",
    latitude: 34.69,
    longitude: 135.19,
    positionPrecision: "locality",
    primaryType: "stationery_store",
    operationalStatus: "open",
    sourceQuality: "sourced",
    specialtyLine: "Main store of the Kobe stationery group",
    shortDescription:
      "The main store of a Kobe stationery group that also runs several pen-focused shops in the city.",
    openingHoursNote: NO_PUBLISHED_HOURS,
    links: [
      { label: "kobe-nagasawa.co.jp", url: "https://kobe-nagasawa.co.jp/", isOfficial: true },
    ],
    motif: "counter",
    sources: [SOURCES.nagasawa],
  },
  {
    id: "shop-jp-nagasawa-penstyle-den",
    slug: "nagasawa-penstyle-den",
    name: "NAGASAWA PenStyle DEN",
    countryCode: "JP",
    localityName: "Kobe",
    localitySlug: "kobe",
    latitude: 34.6925,
    longitude: 135.1955,
    positionPrecision: "locality",
    primaryType: "fountain_pen_specialist",
    operationalStatus: "open",
    sourceQuality: "sourced",
    specialtyLine: "Pen-focused shop in the NAGASAWA group",
    openingHoursNote: NO_PUBLISHED_HOURS,
    links: [
      { label: "kobe-nagasawa.co.jp", url: "https://kobe-nagasawa.co.jp/", isOfficial: true },
    ],
    motif: "nib",
    sources: [SOURCES.nagasawa],
  },

  /* ------------------------------ Taiwan ----------------------------- */
  {
    id: "shop-tw-pen-house-tainan",
    slug: "pen-house-tainan",
    name: "Pen House",
    localName: "文寶房名品",
    countryCode: "TW",
    localityName: "East District, Tainan",
    localitySlug: "east-tainan",
    neighbourhood: "Beimen Road",
    latitude: 22.9944,
    longitude: 120.2118,
    positionPrecision: "street",
    primaryType: "fountain_pen_specialist",
    operationalStatus: "open",
    sourceQuality: "sourced",
    specialtyLine: "Long-established Tainan pen counter",
    addressLines: ["No. 2, Section 1, Beimen Road", "Tainan"],
    openingHours: HOURS.penHouse,
    brands: ["Montblanc", "LAMY", "Pilot", "Cartier", "Pelikan", "Sailor"],
    links: [
      { label: "penhouse.com.tw", url: "https://www.penhouse.com.tw/", isOfficial: true },
    ],
    motif: "storefront",
    sources: [SOURCES.penHouse, SOURCES.penHouseDistrict, SOURCES.founderTaiwan],
  },
  {
    id: "shop-tw-skb-kaohsiung",
    slug: "skb-kaohsiung",
    name: "SKB",
    localName: "SKB文明鋼筆",
    countryCode: "TW",
    localityName: "Kaohsiung",
    localitySlug: "kaohsiung",
    latitude: 22.6273,
    longitude: 120.3014,
    positionPrecision: "locality",
    primaryType: "fountain_pen_specialist",
    operationalStatus: "unknown",
    sourceQuality: "sourced",
    specialtyLine: "Taiwanese pen maker based in Kaohsiung",
    shortDescription:
      "A Taiwanese fountain pen maker based in Kaohsiung. Its own site lists a company address and a dealer directory but does not confirm a retail shopfront, so no shop address is shown here.",
    openingHoursNote: NO_PUBLISHED_HOURS,
    links: [{ label: "skb.com.tw", url: "https://www.skb.com.tw/", isOfficial: true }],
    motif: "workbench",
    sources: [SOURCES.skb, SOURCES.founderTaiwan],
  },
  {
    id: "shop-tw-ty-lee-pen-shop",
    slug: "ty-lee-pen-shop",
    name: "TY Lee Pen Shop",
    localName: "小品雅集",
    countryCode: "TW",
    localityName: "Da'an, Taipei",
    localitySlug: "daan-taipei",
    latitude: 25.0284,
    longitude: 121.5434,
    positionPrecision: "street",
    primaryType: "fountain_pen_specialist",
    operationalStatus: "unknown",
    sourceQuality: "community_unverified",
    specialtyLine: null,
    addressLines: [
      "No. 76, Lane 78, Section 2, Fuxing South Road",
      "Da'an District, Taipei",
    ],
    openingHoursNote: NO_PUBLISHED_HOURS,
    links: [{ label: "tylee.tw", url: "https://www.tylee.tw/", isOfficial: true }],
    motif: "ink-bottle",
    sources: [SOURCES.tyLee, SOURCES.inkantadora],
  },
  {
    id: "shop-tw-juspirit-banqiao",
    slug: "juspirit-banqiao",
    name: "Juspirit",
    localName: "激墨",
    countryCode: "TW",
    localityName: "Banqiao, New Taipei",
    localitySlug: "banqiao-new-taipei",
    latitude: 25.01,
    longitude: 121.463,
    positionPrecision: "street",
    primaryType: "fountain_pen_specialist",
    operationalStatus: "unknown",
    sourceQuality: "community_unverified",
    specialtyLine: null,
    addressLines: [
      "No. 11-28, Section 2, Nanya South Road",
      "Banqiao District, New Taipei City",
    ],
    openingHoursNote: NO_PUBLISHED_HOURS,
    motif: "harbour",
    sources: [SOURCES.inkantadora],
  },
];

/* --------------------------------------------------------------------------
 * Projections
 * ----------------------------------------------------------------------- */

function shopStamp(seed: PrototypeSeed): ShopStampDesign {
  return {
    id: `stamp-${seed.slug}`,
    tier: "shop",
    motif: seed.motif,
    // One ink from the shared global palette, chosen deterministically from the
    // stamp key alone. Nothing about the country, locality, or shop type feeds
    // into it, and nothing reads meaning back out of it.
    ink: inkForStampKey(`stamp-${seed.slug}`),
    localityLabel: seed.localityName,
    countryLabel: COUNTRY_LABELS[seed.countryCode],
    designVersion: PROTOTYPE_DESIGN_VERSION,
    paletteVersion: STAMP_PALETTE_VERSION,
  };
}

/** Seal art shares the stamp system: one ink, chosen the same blind way. */
export function designSeal(input: SealDesignInput): ShopStampDesign {
  return {
    id: input.key,
    tier: input.scope,
    motif: input.scope === "country" ? "harbour" : "arcade",
    ink: inkForStampKey(input.key),
    localityLabel: input.localityName ?? input.countryLabel,
    countryLabel: input.countryLabel,
    designVersion: PROTOTYPE_DESIGN_VERSION,
    paletteVersion: STAMP_PALETTE_VERSION,
  };
}

function toDetail(seed: PrototypeSeed): ShopDetail {
  return {
    id: seed.id,
    slug: seed.slug,
    name: seed.name,
    ...(seed.localName === undefined ? {} : { localName: seed.localName }),
    countryCode: seed.countryCode,
    localityName: seed.localityName,
    position: { latitude: seed.latitude, longitude: seed.longitude },
    primaryType: seed.primaryType,
    specialtyLine: seed.specialtyLine,
    operationalStatus: seed.operationalStatus,
    markerState: "unvisited",
    sourceQuality: seed.sourceQuality,
    fixtureNotice: PROTOTYPE_CATALOGUE_NOTICE,
    ...(seed.shortDescription === undefined
      ? {}
      : { shortDescription: seed.shortDescription }),
    ...(seed.addressLines === undefined ? {} : { addressLines: seed.addressLines }),
    ...(seed.neighbourhood === undefined ? {} : { neighbourhood: seed.neighbourhood }),
    timezone: TIMEZONES[seed.countryCode],
    shopTypes: [seed.primaryType, ...(seed.extraTypes ?? [])],
    ...(seed.brands === undefined ? {} : { brands: seed.brands }),
    ...(seed.openingHours === undefined ? {} : { openingHours: seed.openingHours }),
    ...(seed.openingHoursNote === undefined
      ? {}
      : { openingHoursNote: seed.openingHoursNote }),
    ...(seed.links === undefined ? {} : { links: seed.links }),
    positionPrecision: seed.positionPrecision,
    sources: seed.sources,
    stamp: shopStamp(seed),
  };
}

export const prototypeShopDetails: readonly ShopDetail[] = seeds.map(toDetail);

export const prototypeShopSummaries: readonly ShopMapSummary[] = prototypeShopDetails.map(
  (shop): ShopMapSummary => ({
    id: shop.id,
    slug: shop.slug,
    name: shop.name,
    ...(shop.localName === undefined ? {} : { localName: shop.localName }),
    countryCode: shop.countryCode,
    localityName: shop.localityName,
    position: shop.position,
    primaryType: shop.primaryType,
    specialtyLine: shop.specialtyLine,
    operationalStatus: shop.operationalStatus,
    markerState: shop.markerState,
    sourceQuality: shop.sourceQuality,
    ...(shop.fixtureNotice === undefined ? {} : { fixtureNotice: shop.fixtureNotice }),
  }),
);

export const prototypeLocalitySlugById = new Map<string, string>(
  seeds.map((seed) => [seed.id, seed.localitySlug]),
);

export function findPrototypeShop(slug: string): ShopDetail | undefined {
  return prototypeShopDetails.find((shop) => shop.slug === slug);
}

export function prototypeShopById(id: string): ShopDetail | undefined {
  return prototypeShopDetails.find((shop) => shop.id === id);
}

/**
 * Versioned curated coverage sets.
 *
 * These are the only denominators the interface is allowed to show. Each one
 * names the shops currently eligible in that country and carries a version, so
 * a country seal earned under one version is never re-judged under a later one.
 */
export const prototypeCoverageSets: readonly CountryCoverageSet[] = (["SG", "JP", "TW"] as const).map(
  (countryCode) => ({
    countryCode,
    version: `${countryCode.toLowerCase()}-prototype-2026-08-1`,
    eligibleShopIds: seeds
      .filter((seed) => seed.countryCode === countryCode)
      .map((seed) => seed.id),
  }),
);
