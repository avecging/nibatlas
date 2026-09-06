import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  backedOffUnknownShopIds,
  readUnknownShopImportHolds,
  recordUnknownShopImportHolds,
  releaseUnknownShopImportHolds,
  SAVED_SHOP_IMPORT_HOLDS_STORAGE_KEY,
  UNKNOWN_SHOP_IMPORT_BACKOFF_MS,
} from "@/src/features/saved/saved-shop-import-holds";

describe("saved-shop import holds", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("persists attempt metadata and backs off only until the retry interval", () => {
    const now = Date.UTC(2026, 8, 6);

    expect(recordUnknownShopImportHolds(["unknown-shop"], now)).toEqual([
      "unknown-shop",
    ]);
    expect(recordUnknownShopImportHolds(["unknown-shop"], now + 1_000)).toEqual(
      [],
    );
    expect(readUnknownShopImportHolds()).toEqual([
      {
        localId: "unknown-shop",
        attempts: 2,
        lastTriedAt: now + 1_000,
      },
    ]);
    expect(backedOffUnknownShopIds(now + 2_000)).toContain("unknown-shop");
    expect(
      backedOffUnknownShopIds(now + 1_000 + UNKNOWN_SHOP_IMPORT_BACKOFF_MS),
    ).not.toContain("unknown-shop");

    releaseUnknownShopImportHolds(["unknown-shop"]);

    expect(readUnknownShopImportHolds()).toEqual([]);
  });

  it("ignores malformed persisted metadata", () => {
    window.localStorage.setItem(
      SAVED_SHOP_IMPORT_HOLDS_STORAGE_KEY,
      JSON.stringify({ version: 1, holds: [{ localId: "", attempts: 0 }] }),
    );
    vi.spyOn(Storage.prototype, "setItem");

    expect(readUnknownShopImportHolds()).toEqual([]);
    expect(backedOffUnknownShopIds()).toEqual(new Set());
  });
});
