import type { StampCollection } from "@/src/domain/passport";
import type { EarnedSeal } from "@/src/domain/seals";
import type { CollectionScope } from "@/src/features/collection/collection-store";

/**
 * Download local data.
 *
 * `docs/milestone-1-5-product-refinement.md` puts **Download local data** in
 * Me's **On this device** group, next to the sentence saying the data lives in
 * this browser and goes when browser data is cleared. A control that says that
 * has to be able to hand the data over, or the sentence is an apology rather
 * than a fact.
 *
 * There is no server, so this is not "export my account" — it is a copy of the
 * three things this device is actually holding, written as they are stored. It
 * invents nothing and summarises nothing: `simulated: true` is carried through
 * on every collection that has it, so a file taken from a reviewer device
 * cannot be read as a record of real visits.
 *
 * The payload builder is pure so its shape can be pinned in a test; the browser
 * half is the smallest possible wrapper around it.
 */
export const LOCAL_DATA_SCHEMA = "nib-atlas.local-data/1";

export interface LocalDataExport {
  readonly schema: typeof LOCAL_DATA_SCHEMA;
  /** ISO instant the copy was taken. */
  readonly exportedAt: string;
  /**
   * Which of the two device stores this came from. Named because a reviewer
   * device holds seeded demonstration collections in a separate store, and a
   * file with no provenance could later be read as somebody's real history.
   */
  readonly store: CollectionScope;
  readonly savedShopIds: readonly string[];
  readonly collections: readonly StampCollection[];
  readonly seals: readonly EarnedSeal[];
}

export function buildLocalDataExport({
  scope,
  savedShopIds,
  collections,
  seals,
  exportedAt,
}: {
  readonly scope: CollectionScope;
  readonly savedShopIds: Iterable<string>;
  readonly collections: readonly StampCollection[];
  readonly seals: readonly EarnedSeal[];
  readonly exportedAt: Date;
}): LocalDataExport {
  return {
    schema: LOCAL_DATA_SCHEMA,
    exportedAt: exportedAt.toISOString(),
    store: scope,
    // Sorted so two exports of the same device state are byte-identical and a
    // reader can diff them.
    savedShopIds: [...savedShopIds].sort(),
    collections,
    seals,
  };
}

/** `nib-atlas-data-2026-08-27.json`, in the reader's own local date. */
export function localDataFilename(exportedAt: Date): string {
  const date = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(exportedAt);

  return `nib-atlas-data-${date}.json`;
}

export function serializeLocalDataExport(payload: LocalDataExport): string {
  return `${JSON.stringify(payload, null, 2)}\n`;
}

/**
 * Hands the file to the browser.
 *
 * An object URL and a synthetic click, because there is no server to stream
 * from. The URL is revoked on the next frame rather than immediately: Safari
 * has historically cancelled the download if the blob is released within the
 * same task as the click.
 *
 * Returns whether the download was started, so the caller can say something
 * accurate if the browser refuses rather than silently appearing to work.
 */
export function downloadLocalData(payload: LocalDataExport): boolean {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return false;
  }

  try {
    const blob = new Blob([serializeLocalDataExport(payload)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");

    anchor.href = url;
    anchor.download = localDataFilename(new Date(payload.exportedAt));
    anchor.rel = "noopener";
    document.body.append(anchor);
    anchor.click();
    anchor.remove();

    window.setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 0);

    return true;
  } catch {
    return false;
  }
}
