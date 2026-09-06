const STORAGE_KEY = "nib-atlas.saved-shop-import-holds.v1";

export const UNKNOWN_SHOP_IMPORT_BACKOFF_MS = 7 * 24 * 60 * 60 * 1_000;

export interface UnknownShopImportHold {
  readonly localId: string;
  readonly attempts: number;
  readonly lastTriedAt: number;
}

interface PersistedImportHolds {
  readonly version: 1;
  readonly holds: readonly UnknownShopImportHold[];
}

function readImportHolds(): readonly UnknownShopImportHold[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);

    if (raw === null) {
      return [];
    }

    const parsed: unknown = JSON.parse(raw);

    if (
      typeof parsed !== "object" ||
      parsed === null ||
      (parsed as Partial<PersistedImportHolds>).version !== 1 ||
      !Array.isArray((parsed as Partial<PersistedImportHolds>).holds)
    ) {
      return [];
    }

    const holds = (parsed as PersistedImportHolds).holds.filter(
      (hold) =>
        typeof hold === "object" &&
        hold !== null &&
        typeof hold.localId === "string" &&
        hold.localId.length > 0 &&
        Number.isInteger(hold.attempts) &&
        hold.attempts > 0 &&
        Number.isFinite(hold.lastTriedAt),
    );
    const deduplicated = new Map(holds.map((hold) => [hold.localId, hold]));

    return [...deduplicated.values()];
  } catch {
    return [];
  }
}

function writeImportHolds(holds: readonly UnknownShopImportHold[]): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ version: 1, holds } satisfies PersistedImportHolds),
    );
  } catch {
    // Storage is best effort. The provider still holds this page's attempts
    // in memory, so an unavailable store cannot create an immediate loop.
  }
}

export function readUnknownShopImportHolds(): readonly UnknownShopImportHold[] {
  return readImportHolds();
}

export function recordUnknownShopImportHolds(
  localIds: readonly string[],
  triedAt = Date.now(),
): readonly string[] {
  if (localIds.length === 0) {
    return [];
  }

  const holds = new Map(readImportHolds().map((hold) => [hold.localId, hold]));
  const newlyHeld: string[] = [];

  for (const localId of new Set(localIds)) {
    const current = holds.get(localId);

    if (!current) {
      newlyHeld.push(localId);
    }

    holds.set(localId, {
      localId,
      attempts: (current?.attempts ?? 0) + 1,
      lastTriedAt: triedAt,
    });
  }

  writeImportHolds([...holds.values()]);

  return newlyHeld;
}

export function releaseUnknownShopImportHolds(
  localIds: readonly string[],
): void {
  if (localIds.length === 0) {
    return;
  }

  const released = new Set(localIds);
  const current = readImportHolds();
  const remaining = current.filter((hold) => !released.has(hold.localId));

  if (remaining.length !== current.length) {
    writeImportHolds(remaining);
  }
}

export function backedOffUnknownShopIds(
  now = Date.now(),
): ReadonlySet<string> {
  return new Set(
    readImportHolds()
      .filter((hold) => now - hold.lastTriedAt < UNKNOWN_SHOP_IMPORT_BACKOFF_MS)
      .map((hold) => hold.localId),
  );
}

export const SAVED_SHOP_IMPORT_HOLDS_STORAGE_KEY = STORAGE_KEY;
