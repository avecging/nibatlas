import { STAMP_MOTIFS } from '@/src/domain/stamp-design';
import { STAMP_INK_LABELS } from '@/src/domain/stamp-palette';
import type { EditorialContent, EditorialReview, ShopStampDesign } from '@/src/domain/shop-detail';
import { isCountryCode, type CountryCode, type GeoPoint, type ViewportBounds } from "@/src/domain/geo";
import { isLanguageTag, type LanguageTag } from "@/src/domain/language";
import {
  isShopType,
  validTypeLabel,
  type MarkerState,
  type OperationalStatus,
  type ShopMapSummary,
  type ShopType,
  type SourceQuality,
} from "@/src/domain/shops";
import type {
  OpeningHoursEntry,
  PositionPrecision,
  ServiceAccessMode,
  ShopService,
  ShopSourceRef,
} from "@/src/domain/shop-detail";
import { SHOP_SOURCE_KINDS } from "@/src/domain/shop-detail";
import {
  serviceEvidenceToken,
  sourceEvidenceFailure,
} from "@/src/domain/shop-evidence";

export const PUBLIC_SOURCE_KINDS = SHOP_SOURCE_KINDS;

export type PublicSourceKind = (typeof PUBLIC_SOURCE_KINDS)[number];

export interface ViewportShopsV1 {
  readonly shops: readonly ShopMapSummary[];
  readonly truncated: boolean;
  readonly committedBounds: ViewportBounds;
}

export interface ShopSearchHitV1 {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly countryCode: CountryCode;
  readonly localityName: string;
  readonly matchedAlias?: string;
}

export interface ShopSearchV1 {
  readonly shops: readonly ShopSearchHitV1[];
  readonly query: string;
}

export interface NearbyShopV1 {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly countryCode: CountryCode;
  readonly localityName: string;
  readonly position: GeoPoint;
  readonly positionPrecision: PositionPrecision;
  readonly primaryType: ShopType;
  readonly primaryTypeLabel?: string;
  readonly operationalStatus: OperationalStatus;
  readonly distanceMeters: number;
}

export interface NearbyShopsV1 {
  readonly shops: readonly NearbyShopV1[];
  readonly radiusMeters: number;
}

export interface PublicShopSourceV1 extends ShopSourceRef {
  readonly kind: PublicSourceKind;
}

export type PublicShopServiceV1 = ShopService;

export interface PublicShopLinkV1 {
  readonly type: string;
  readonly label?: string;
  readonly url: string;
  readonly isOfficial: boolean;
}

/**
 * Database-backed detail before the Milestone 3 presentation adapter adds the
 * deterministic stamp design and other frontend-only presentation fields.
 * Evidence references are stable source UUIDs, never display labels.
 */
export interface PublicGeneratedStampV1 {
  readonly id: string;
  readonly designVersion: number;
  readonly ink: ShopStampDesign['ink'];
  readonly paletteVersion: number;
  readonly templateData: { readonly tier: 'shop'; readonly motif: ShopStampDesign['motif'] };
}
export interface ShopDetailReadV1 extends ShopMapSummary {
  readonly review?: EditorialReview;
  readonly editorial?: EditorialContent;
  /** Absent for older APIs and non-generated artwork. Never invent stored art. */
  readonly generatedStamp?: PublicGeneratedStampV1;
  readonly shortDescription?: string;
  readonly addressLines?: readonly string[];
  readonly postalCode?: string;
  readonly neighbourhood?: string;
  readonly timezone: string;
  readonly positionPrecision: PositionPrecision;
  readonly phone?: string;
  readonly websiteUrl?: string;
  readonly openingHours?: readonly OpeningHoursEntry[];
  readonly openingHoursNote?: string;
  readonly lastVerifiedAt?: string;
  readonly shopTypes: readonly ShopType[];
  readonly shopTypeLabels?: Readonly<Record<string,string>>;
  readonly specialties: readonly string[];
  readonly services: readonly PublicShopServiceV1[];
  readonly brands: readonly string[];
  readonly links: readonly PublicShopLinkV1[];
  readonly sources: readonly PublicShopSourceV1[];
}

export class ShopReadContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ShopReadContractError";
  }
}

type JsonRecord = Record<string, unknown>;

function record(value: unknown, at: string): JsonRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new ShopReadContractError(`${at} must be an object`);
  }

  return value as JsonRecord;
}

function string(value: unknown, at: string): string {
  if (typeof value !== "string") {
    throw new ShopReadContractError(`${at} must be a string`);
  }

  return value;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function uuid(value: unknown, at: string): string {
  const parsed = string(value, at);

  if (!UUID_PATTERN.test(parsed)) {
    throw new ShopReadContractError(`${at} must be a UUID`);
  }

  return parsed;
}

function number(value: unknown, at: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new ShopReadContractError(`${at} must be a finite number`);
  }

  return value;
}

function boolean(value: unknown, at: string): boolean {
  if (typeof value !== "boolean") {
    throw new ShopReadContractError(`${at} must be a boolean`);
  }

  return value;
}

function optionalString(value: unknown, at: string): string | undefined {
  return value === undefined ? undefined : string(value, at);
}

function stringArray(value: unknown, at: string): readonly string[] {
  if (!Array.isArray(value)) {
    throw new ShopReadContractError(`${at} must be an array`);
  }

  return value.map((entry, index) => string(entry, `${at}[${index}]`));
}

function countryCode(value: unknown, at: string): CountryCode {
  const parsed = string(value, at);

  if (!isCountryCode(parsed)) {
    throw new ShopReadContractError(`${at} must be an ISO alpha-2-shaped code`);
  }

  return parsed;
}

function enumValue<const T extends readonly string[]>(
  value: unknown,
  allowed: T,
  at: string,
): T[number] {
  const parsed = string(value, at);

  if (!(allowed as readonly string[]).includes(parsed)) {
    throw new ShopReadContractError(`${at} is outside the public vocabulary`);
  }

  return parsed as T[number];
}

function point(value: unknown, at: string): GeoPoint {
  const item = record(value, at);

  return {
    latitude: number(item["latitude"], `${at}.latitude`),
    longitude: number(item["longitude"], `${at}.longitude`),
  };
}

function bounds(value: unknown, at: string): ViewportBounds {
  const item = record(value, at);

  return {
    west: number(item["west"], `${at}.west`),
    south: number(item["south"], `${at}.south`),
    east: number(item["east"], `${at}.east`),
    north: number(item["north"], `${at}.north`),
  };
}

const OPERATIONAL_STATUSES = [
  "open",
  "temporarily_closed",
  "permanently_closed",
  "unknown",
] as const satisfies readonly OperationalStatus[];
const MARKER_STATES = ["unvisited", "saved", "visited"] as const satisfies readonly MarkerState[];
const SOURCE_QUALITIES = [
  "verified",
  "sourced",
  "community_unverified",
  "demo",
] as const satisfies readonly SourceQuality[];
const POSITION_PRECISIONS = ["street", "locality"] as const satisfies readonly PositionPrecision[];
const OPENING_DAYS = [
  "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday",
] as const;
const ACCESS_MODES = ["walk_in", "booking", "send_in", "enquire"] as const satisfies readonly ServiceAccessMode[];

function shopType(value: unknown, at: string): ShopType {
  if (!isShopType(value)) throw new ShopReadContractError(`${at} is outside the public vocabulary`);
  return value;
}
function primaryTypeLabel(item: JsonRecord): {primaryTypeLabel?: string} {
  const label=item.primaryTypeLabel;
  if (label === undefined && !String(item.primaryType).startsWith('type_')) return {};
  if (!validTypeLabel(label)) throw new ShopReadContractError('Invalid primary type label');
  return {primaryTypeLabel:label};
}
function typeLabels(item: JsonRecord): {shopTypeLabels?: Readonly<Record<string,string>>} {
  const types = item.shopTypes;
  if (item.shopTypeLabels === undefined && Array.isArray(types) && !types.some(t=>String(t).startsWith('type_'))) return {};
  const labels=record(item.shopTypeLabels,'detail.shopTypeLabels');
  if (!Array.isArray(types) || Object.keys(labels).length>100 || Object.entries(labels).some(([k,v])=>!isShopType(k) || !types.includes(k) || !validTypeLabel(v)) ||
    types.some(t=>String(t).startsWith('type_') && !validTypeLabel(labels[String(t)]))) throw new ShopReadContractError('Invalid type labels');
  return {shopTypeLabels:labels as Record<string,string>};
}

function mapShop(value: unknown, at: string): ShopMapSummary {
  const item = record(value, at);
  const specialty = item["specialtyLine"];

  if (specialty !== null && typeof specialty !== "string") {
    throw new ShopReadContractError(`${at}.specialtyLine must be string or null`);
  }

  if (item["primaryType"] === "test_venue" && item["sourceQuality"] !== "demo") {
    throw new ShopReadContractError("Test venues must remain demo data");
  }

  const output: ShopMapSummary = {
    id: string(item["id"], `${at}.id`),
    slug: string(item["slug"], `${at}.slug`),
    name: string(item["name"], `${at}.name`),
    countryCode: countryCode(item["countryCode"], `${at}.countryCode`),
    localityName: string(item["localityName"], `${at}.localityName`),
    position: point(item["position"], `${at}.position`),
    primaryType: shopType(item["primaryType"], `${at}.primaryType`),
    ...primaryTypeLabel(item),
    specialtyLine: specialty,
    operationalStatus: enumValue(item["operationalStatus"], OPERATIONAL_STATUSES, `${at}.operationalStatus`),
    markerState: enumValue(item["markerState"], MARKER_STATES, `${at}.markerState`),
    sourceQuality: enumValue(item["sourceQuality"], SOURCE_QUALITIES, `${at}.sourceQuality`),
  };
  if (output.markerState !== "unvisited") {
    throw new ShopReadContractError(`${at}.markerState must be unvisited in a public read`);
  }
  const localName = optionalString(item["localName"], `${at}.localName`);
  const localNameLangValue = optionalString(item["localNameLang"], `${at}.localNameLang`);
  let localNameLang: LanguageTag | undefined;

  if (localNameLangValue !== undefined) {
    if (!isLanguageTag(localNameLangValue)) {
      throw new ShopReadContractError(`${at}.localNameLang must be a valid BCP 47 tag`);
    }
    localNameLang = localNameLangValue;
  }
  if ((localName === undefined) !== (localNameLang === undefined)) {
    throw new ShopReadContractError(`${at}.localName and localNameLang must be paired`);
  }
  const fixtureNotice = optionalString(item["fixtureNotice"], `${at}.fixtureNotice`);

  return {
    ...output,
    ...(localName === undefined ? {} : { localName }),
    ...(localNameLang === undefined ? {} : { localNameLang }),
    ...(fixtureNotice === undefined ? {} : { fixtureNotice }),
  };
}

export function decodeViewportShopsV1(value: unknown): ViewportShopsV1 {
  const item = record(value, "viewport");

  if (!Array.isArray(item["shops"])) {
    throw new ShopReadContractError("viewport.shops must be an array");
  }

  return {
    shops: item["shops"].map((shop, index) => mapShop(shop, `viewport.shops[${index}]`)),
    truncated: boolean(item["truncated"], "viewport.truncated"),
    committedBounds: bounds(item["committedBounds"], "viewport.committedBounds"),
  };
}

export function decodeShopSearchV1(value: unknown): ShopSearchV1 {
  const item = record(value, "search");

  if (!Array.isArray(item["shops"])) {
    throw new ShopReadContractError("search.shops must be an array");
  }

  return {
    query: string(item["query"], "search.query"),
    shops: item["shops"].map((entry, index) => {
      const hit = record(entry, `search.shops[${index}]`);
      const matchedAlias = optionalString(hit["matchedAlias"], `search.shops[${index}].matchedAlias`);

      return {
        id: string(hit["id"], `search.shops[${index}].id`),
        slug: string(hit["slug"], `search.shops[${index}].slug`),
        name: string(hit["name"], `search.shops[${index}].name`),
        countryCode: countryCode(hit["countryCode"], `search.shops[${index}].countryCode`),
        localityName: string(hit["localityName"], `search.shops[${index}].localityName`),
        ...(matchedAlias === undefined ? {} : { matchedAlias }),
      };
    }),
  };
}

export function decodeNearbyShopsV1(value: unknown): NearbyShopsV1 {
  const item = record(value, "nearby");

  if (!Array.isArray(item["shops"])) {
    throw new ShopReadContractError("nearby.shops must be an array");
  }

  return {
    radiusMeters: number(item["radiusMeters"], "nearby.radiusMeters"),
    shops: item["shops"].map((entry, index) => {
      const shop = record(entry, `nearby.shops[${index}]`);

      return {
        id: string(shop["id"], `nearby.shops[${index}].id`),
        slug: string(shop["slug"], `nearby.shops[${index}].slug`),
        name: string(shop["name"], `nearby.shops[${index}].name`),
        countryCode: countryCode(shop["countryCode"], `nearby.shops[${index}].countryCode`),
        localityName: string(shop["localityName"], `nearby.shops[${index}].localityName`),
        position: point(shop["position"], `nearby.shops[${index}].position`),
        positionPrecision: enumValue(
          shop["positionPrecision"],
          POSITION_PRECISIONS,
          `nearby.shops[${index}].positionPrecision`,
        ),
        primaryType: shopType(
          shop["primaryType"],
          `nearby.shops[${index}].primaryType`,
        ),
        ...primaryTypeLabel(shop),
        operationalStatus: enumValue(
          shop["operationalStatus"],
          OPERATIONAL_STATUSES,
          `nearby.shops[${index}].operationalStatus`,
        ),
        distanceMeters: number(shop["distanceMeters"], `nearby.shops[${index}].distanceMeters`),
      };
    }),
  };
}

function openingHours(value: unknown): readonly OpeningHoursEntry[] {
  if (!Array.isArray(value)) {
    throw new ShopReadContractError("detail.openingHours must be an array");
  }

  return value.map((entry, index) => {
    const item = record(entry, `detail.openingHours[${index}]`);
    const opens = optionalString(item["opens"], `detail.openingHours[${index}].opens`);
    const closes = optionalString(item["closes"], `detail.openingHours[${index}].closes`);
    const note = optionalString(item["note"], `detail.openingHours[${index}].note`);
    const closed = item["closed"] === undefined ? undefined : boolean(item["closed"], `detail.openingHours[${index}].closed`);

    return {
      day: enumValue(item["day"], OPENING_DAYS, `detail.openingHours[${index}].day`),
      ...(opens === undefined ? {} : { opens }),
      ...(closes === undefined ? {} : { closes }),
      ...(closed === undefined ? {} : { closed }),
      ...(note === undefined ? {} : { note }),
    };
  });
}

export function decodeShopDetailV1(value: unknown): ShopDetailReadV1 | null {
  if (value === null) {
    return null;
  }

  const item = record(value, "detail");
  const base = mapShop(value, "detail");
  const arrayOf = <T>(key: string, decode: (entry: unknown, index: number) => T): readonly T[] => {
    const entries = item[key];
    if (!Array.isArray(entries)) throw new ShopReadContractError(`detail.${key} must be an array`);
    return entries.map(decode);
  };
  const optional = (key: string) => optionalString(item[key], `detail.${key}`);
  const addressLines = item["addressLines"] === undefined ? undefined : stringArray(item["addressLines"], "detail.addressLines");
  const hours = item["openingHours"] === undefined ? undefined : openingHours(item["openingHours"]);
  const shortDescription = optional("shortDescription");
  const postalCode = optional("postalCode");
  const neighbourhood = optional("neighbourhood");
  const phone = optional("phone");
  const websiteUrl = optional("websiteUrl");
  const openingHoursNote = optional("openingHoursNote");
  const lastVerifiedAt = optional("lastVerifiedAt");

  if (Array.isArray(item["shopTypes"]) && item["shopTypes"].includes("test_venue") && base.sourceQuality !== "demo") {
    throw new ShopReadContractError("Test venues must remain demo data");
  }

  const review = item.review === undefined ? undefined : decodeEditorialReview(item.review);
  const services = arrayOf<ShopService>("services", (entry, index) => {
    const service = record(entry, `detail.services[${index}]`);
    const accessMode = service["accessMode"] === undefined ? undefined : enumValue(service["accessMode"], ACCESS_MODES, `detail.services[${index}].accessMode`);
    const duration = optionalString(service["duration"], `detail.services[${index}].duration`);
    const note = optionalString(service["note"], `detail.services[${index}].note`);
    return {
      label: string(service["label"], `detail.services[${index}].label`),
      ...(service.reviewedEditorially === true && review
        ? { reviewedEditorially: true as const }
        : { confirmedBy: uuid(service["confirmedBy"], `detail.services[${index}].confirmedBy`) }),
      ...(accessMode === undefined ? {} : { accessMode }),
      ...(duration === undefined ? {} : { duration }),
      ...(note === undefined ? {} : { note }),
    };
  });
  const sources = arrayOf("sources", (entry, index) => {
    const source = record(entry, `detail.sources[${index}]`);
    const url = optionalString(source["url"], `detail.sources[${index}].url`);
    return {
      id: uuid(source["id"], `detail.sources[${index}].id`),
      label: string(source["label"], `detail.sources[${index}].label`),
      kind: enumValue(source["kind"], PUBLIC_SOURCE_KINDS, `detail.sources[${index}].kind`),
      retrievedOn: string(source["retrievedOn"], `detail.sources[${index}].retrievedOn`),
      confirms: stringArray(source["confirms"], `detail.sources[${index}].confirms`),
      ...(url === undefined ? {} : { url }),
    };
  });
  const sourceIds = new Set<string>();

  for (const source of sources) {
    if (sourceIds.has(source.id)) {
      throw new ShopReadContractError(`detail.sources contains duplicate source UUID ${source.id}`);
    }
    sourceIds.add(source.id);
  }

  services.forEach((service, index) => {
    if (service.reviewedEditorially && review) return;
    const failure = sourceEvidenceFailure(
      sources,
      service.confirmedBy ?? "",
      serviceEvidenceToken(service.label),
    );

    if (failure !== null) {
      throw new ShopReadContractError(
        `detail.services[${index}].confirmedBy has ${failure}`,
      );
    }
  });

  return {
    ...base,
    ...(review ? { review } : {}),
    ...(item.editorial === undefined ? {} : { editorial: decodeEditorialContent(item.editorial) }),
    ...(item.generatedStamp === undefined ? {} : { generatedStamp: decodeGeneratedStamp(item.generatedStamp) }),
    timezone: string(item["timezone"], "detail.timezone"),
    positionPrecision: enumValue(item["positionPrecision"], POSITION_PRECISIONS, "detail.positionPrecision"),
    shopTypes: arrayOf("shopTypes", (entry, index) => shopType(entry, `detail.shopTypes[${index}]`)),
    ...typeLabels(item),
    specialties: stringArray(item["specialties"], "detail.specialties"),
    services,
    brands: stringArray(item["brands"], "detail.brands"),
    links: arrayOf("links", (entry, index) => {
      const link = record(entry, `detail.links[${index}]`);
      const label = optionalString(link["label"], `detail.links[${index}].label`);
      return {
        type: string(link["type"], `detail.links[${index}].type`),
        url: string(link["url"], `detail.links[${index}].url`),
        isOfficial: boolean(link["isOfficial"], `detail.links[${index}].isOfficial`),
        ...(label === undefined ? {} : { label }),
      };
    }),
    sources,
    ...(shortDescription === undefined ? {} : { shortDescription }),
    ...(addressLines === undefined ? {} : { addressLines }),
    ...(postalCode === undefined ? {} : { postalCode }),
    ...(neighbourhood === undefined ? {} : { neighbourhood }),
    ...(phone === undefined ? {} : { phone }),
    ...(websiteUrl === undefined ? {} : { websiteUrl }),
    ...(hours === undefined ? {} : { openingHours: hours }),
    ...(openingHoursNote === undefined ? {} : { openingHoursNote }),
    ...(lastVerifiedAt === undefined ? {} : { lastVerifiedAt }),
  };
}

function decodeGeneratedStamp(value: unknown): PublicGeneratedStampV1 {
  const r = record(value, 'detail.generatedStamp'), template = record(r.templateData, 'detail.generatedStamp.templateData');
  const id = uuid(r.id, 'detail.generatedStamp.id');
  if (!Number.isSafeInteger(r.designVersion) || Number(r.designVersion) < 1 || r.paletteVersion !== 1
    || typeof r.ink !== 'string' || !Object.hasOwn(STAMP_INK_LABELS, r.ink)
    || template.tier !== 'shop' || !STAMP_MOTIFS.includes(template.motif as ShopStampDesign['motif'])) {
    throw new ShopReadContractError('Invalid active generated stamp');
  }
  return { id, designVersion: Number(r.designVersion), paletteVersion: 1, ink: r.ink as ShopStampDesign['ink'],
    templateData: { tier: 'shop', motif: template.motif as ShopStampDesign['motif'] } };
}

function decodeEditorialReview(value: unknown): EditorialReview {
  const r = record(value, 'detail.review');
  if (r.kind !== 'editorial' || typeof r.reviewedAt !== 'string'
    || !/^\d{4}-\d{2}-\d{2}T/.test(r.reviewedAt) || !Number.isFinite(Date.parse(r.reviewedAt)))
    throw new ShopReadContractError('Invalid editorial review');
  return { kind: 'editorial', reviewedAt: r.reviewedAt };
}
export function decodeEditorialContent(value: unknown): EditorialContent {
  const r = record(value, 'detail.editorial');
  const result: Record<string, unknown> = {};
  // Public allowlist only: never spread a draft or an upstream object.
  for (const k of ['feature_headline','field_note_heading','field_note_body','local_address','unit_floor',
    'nearest_station','station_exit','walking_guidance','entrance_notes','editions_text','payment_methods',
    'languages','holiday_note','accessibility_notes']) {
    if (r[k] !== undefined && r[k] !== null) {
      const v = string(r[k], `editorial.${k}`);
      if (v.length > 4000) throw new ShopReadContractError('Editorial text too long');
      if (v) result[k] = v;
    }
  }
  if (r.appointment_required !== undefined && r.appointment_required !== null)
    result.appointment_required = boolean(r.appointment_required, 'editorial.appointment_required');
  if (r.experiences !== undefined) {
    if (!Array.isArray(r.experiences) || r.experiences.length > 100) throw new ShopReadContractError('Invalid experiences');
    result.experiences = r.experiences.map((v) => {
      const e = record(v, 'editorial.experiences');
      const title = string(e.title, 'experience.title');
      const description = e.description == null ? undefined : string(e.description, 'experience.description');
      if (!title.trim() || title.length > 4000 || (description?.length ?? 0) > 4000) throw new ShopReadContractError('Invalid experience');
      return { id: uuid(e.id, 'experience.id'), title,
        category: enumValue(e.category, ['fountain_pens','inks_paper','nib_testing','gifts','repairs','other'], 'experience.category'),
        ...(description ? { description } : {}) };
    });
  }
  return result as EditorialContent;
}
