import { isCountryCode, type CountryCode, type GeoPoint } from "@/src/domain/geo";
import { isLanguageTag, type LanguageTag } from "@/src/domain/language";
import {
  isShopType,
  validTypeLabel,
  type OperationalStatus,
  type ShopMapSummary,
  type SourceQuality,
} from "@/src/domain/shops";

export interface SavedShopV1 extends ShopMapSummary {
  readonly markerState: "saved";
  readonly savedAt: string;
}

export interface SavedShopsV1 {
  readonly savedShopIds: readonly string[];
  readonly shops: readonly SavedShopV1[];
}

export interface SavedShopMutationV1 {
  readonly ok: true;
  readonly shopId: string;
  readonly saved: boolean;
  readonly shop?: SavedShopV1;
}

export interface LocalSavedShopCandidateV1 {
  readonly localId: string;
  readonly slug?: string;
}

export type LocalSavedShopSkipReasonV1 = "invalid-id" | "unknown-shop";
export type LocalSavedShopFailureReasonV1 = "unavailable";

export interface SavedShopImportV1 {
  readonly ok: true;
  readonly reconciled: readonly {
    readonly localId: string;
    readonly shop: SavedShopV1;
  }[];
  readonly skipped: readonly {
    readonly localId: string;
    readonly reason: LocalSavedShopSkipReasonV1;
  }[];
  readonly failed: readonly {
    readonly localId: string;
    readonly reason: LocalSavedShopFailureReasonV1;
  }[];
}

export class SavedShopContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SavedShopContractError";
  }
}

type JsonRecord = Record<string, unknown>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const OPERATIONAL_STATUSES = [
  "open",
  "temporarily_closed",
  "permanently_closed",
  "unknown",
] as const satisfies readonly OperationalStatus[];
const SOURCE_QUALITIES = [
  "verified",
  "sourced",
  "community_unverified",
  "demo",
] as const satisfies readonly SourceQuality[];

function record(value: unknown, at: string): JsonRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new SavedShopContractError(`${at} must be an object`);
  }

  return value as JsonRecord;
}

function string(value: unknown, at: string): string {
  if (typeof value !== "string") {
    throw new SavedShopContractError(`${at} must be a string`);
  }

  return value;
}

function finiteNumber(value: unknown, at: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new SavedShopContractError(`${at} must be a finite number`);
  }

  return value;
}

function oneOf<const T extends readonly string[]>(
  value: unknown,
  allowed: T,
  at: string,
): T[number] {
  const parsed = string(value, at);

  if (!(allowed as readonly string[]).includes(parsed)) {
    throw new SavedShopContractError(`${at} is outside the public vocabulary`);
  }

  return parsed as T[number];
}

function optionalString(value: unknown, at: string): string | undefined {
  return value === undefined ? undefined : string(value, at);
}

function uuid(value: unknown, at: string): string {
  const parsed = string(value, at);

  if (!UUID.test(parsed)) {
    throw new SavedShopContractError(`${at} must be a UUID`);
  }

  return parsed;
}

function timestamp(value: unknown, at: string): string {
  const parsed = string(value, at);

  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(parsed)) {
    throw new SavedShopContractError(`${at} must be an ISO timestamp`);
  }

  return parsed;
}

function point(value: unknown, at: string): GeoPoint {
  const item = record(value, at);

  return {
    latitude: finiteNumber(item["latitude"], `${at}.latitude`),
    longitude: finiteNumber(item["longitude"], `${at}.longitude`),
  };
}

export function decodeSavedShopV1(value: unknown, at = "shop"): SavedShopV1 {
  const item = record(value, at);
  const id = uuid(item["id"], `${at}.id`);
  const markerState = oneOf(item["markerState"], ["saved"] as const, `${at}.markerState`);
  const country = string(item["countryCode"], `${at}.countryCode`);

  if (!isCountryCode(country)) {
    throw new SavedShopContractError(`${at}.countryCode must be an ISO alpha-2-shaped code`);
  }

  if (item["primaryType"] === "test_venue" && item["sourceQuality"] !== "demo") {
    throw new SavedShopContractError("Test venues must remain demo data");
  }

  if (!isShopType(item.primaryType) || (item.primaryTypeLabel !== undefined || String(item.primaryType).startsWith('type_')) && !validTypeLabel(item.primaryTypeLabel)) {
    throw new SavedShopContractError('Invalid shop type or label');
  }
  const output: SavedShopV1 = {
    id,
    slug: string(item["slug"], `${at}.slug`),
    name: string(item["name"], `${at}.name`),
    countryCode: country as CountryCode,
    localityName: string(item["localityName"], `${at}.localityName`),
    position: point(item["position"], `${at}.position`),
    primaryType: item.primaryType,
    ...(validTypeLabel(item.primaryTypeLabel) ? {primaryTypeLabel:item.primaryTypeLabel} : {}),
    specialtyLine:
      item["specialtyLine"] === null
        ? null
        : string(item["specialtyLine"], `${at}.specialtyLine`),
    operationalStatus: oneOf(
      item["operationalStatus"],
      OPERATIONAL_STATUSES,
      `${at}.operationalStatus`,
    ),
    markerState,
    sourceQuality: oneOf(item["sourceQuality"], SOURCE_QUALITIES, `${at}.sourceQuality`),
    savedAt: timestamp(item["savedAt"], `${at}.savedAt`),
  };
  const localName = optionalString(item["localName"], `${at}.localName`);
  const localNameLang = optionalString(item["localNameLang"], `${at}.localNameLang`);
  const fixtureNotice = optionalString(item["fixtureNotice"], `${at}.fixtureNotice`);

  if ((localName === undefined) !== (localNameLang === undefined)) {
    throw new SavedShopContractError(`${at}.localName and localNameLang must be paired`);
  }
  if (localNameLang !== undefined && !isLanguageTag(localNameLang)) {
    throw new SavedShopContractError(`${at}.localNameLang must be a BCP 47 language tag`);
  }
  if (output.sourceQuality === "demo" && fixtureNotice === undefined) {
    throw new SavedShopContractError(`${at}.fixtureNotice is required for demo data`);
  }
  if (output.sourceQuality !== "demo" && fixtureNotice !== undefined) {
    throw new SavedShopContractError(`${at}.fixtureNotice is reserved for demo data`);
  }

  return {
    ...output,
    ...(localName === undefined ? {} : { localName }),
    ...(localNameLang === undefined ? {} : { localNameLang: localNameLang as LanguageTag }),
    ...(fixtureNotice === undefined ? {} : { fixtureNotice }),
  };
}

export function decodeSavedShopsV1(value: unknown): SavedShopsV1 {
  const item = record(value, "saved shops");
  const rawIds = item["savedShopIds"];
  const rawShops = item["shops"];

  if (!Array.isArray(rawIds) || !Array.isArray(rawShops)) {
    throw new SavedShopContractError("saved shops identifiers and details must be arrays");
  }

  const savedShopIds = rawIds.map((entry, index) => uuid(entry, `savedShopIds[${index}]`));
  const shops = rawShops.map((entry, index) => decodeSavedShopV1(entry, `shops[${index}]`));

  if (
    new Set(savedShopIds).size !== savedShopIds.length ||
    savedShopIds.length !== shops.length ||
    savedShopIds.some((id, index) => shops[index]?.id !== id)
  ) {
    throw new SavedShopContractError("saved shop identifiers and details must align");
  }

  return { savedShopIds, shops };
}

export function decodeSavedShopImportV1(value: unknown): SavedShopImportV1 {
  const item = record(value, "saved shop import");

  if (item["ok"] !== true) {
    throw new SavedShopContractError("saved shop import must be successful");
  }

  const rawReconciled = item["reconciled"];
  const rawSkipped = item["skipped"];
  const rawFailed = item["failed"];

  if (
    !Array.isArray(rawReconciled) ||
    !Array.isArray(rawSkipped) ||
    !Array.isArray(rawFailed)
  ) {
    throw new SavedShopContractError("saved shop import results must be arrays");
  }

  const reconciled = rawReconciled.map((entry, index) => {
    const result = record(entry, `reconciled[${index}]`);

    return {
      localId: string(result["localId"], `reconciled[${index}].localId`),
      shop: decodeSavedShopV1(result["shop"], `reconciled[${index}].shop`),
    };
  });
  const skipped = rawSkipped.map((entry, index) => {
    const result = record(entry, `skipped[${index}]`);

    return {
      localId: string(result["localId"], `skipped[${index}].localId`),
      reason: oneOf(
        result["reason"],
        ["invalid-id", "unknown-shop"] as const,
        `skipped[${index}].reason`,
      ),
    };
  });
  const failed = rawFailed.map((entry, index) => {
    const result = record(entry, `failed[${index}]`);

    return {
      localId: string(result["localId"], `failed[${index}].localId`),
      reason: oneOf(
        result["reason"],
        ["unavailable"] as const,
        `failed[${index}].reason`,
      ),
    };
  });
  const localIds = [
    ...reconciled.map((result) => result.localId),
    ...skipped.map((result) => result.localId),
    ...failed.map((result) => result.localId),
  ];

  if (new Set(localIds).size !== localIds.length) {
    throw new SavedShopContractError("saved shop import results must not overlap");
  }

  return { ok: true, reconciled, skipped, failed };
}

export function isShopId(value: string): boolean {
  return UUID.test(value);
}
