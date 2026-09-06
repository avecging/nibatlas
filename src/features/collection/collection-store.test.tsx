import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

import {
  COLLECTION_STORAGE_KEYS,
  CollectionProvider,
  LEGACY_COLLECTION_SESSION_KEY,
  localCollectionDate,
  useCollection,
} from "@/src/features/collection/collection-store";
import {
  ReviewerModeProvider,
  useReviewerModeStore,
} from "@/src/features/reviewer/ReviewerModeProvider";
import {
  findPrototypeShop,
  prototypeShopDetails,
} from "@/src/fixtures/prototype-catalogue";
import { SAVED_SHOP_IMPORT_HOLDS_STORAGE_KEY } from "@/src/features/saved/saved-shop-import-holds";
import { prototypeSeedCollections } from "@/src/fixtures/prototype-passport";
import { seedReviewerMode } from "@/src/test/reviewer";

function Providers({ children }: { readonly children: ReactNode }) {
  return (
    <ReviewerModeProvider>
      <CollectionProvider>{children}</CollectionProvider>
    </ReviewerModeProvider>
  );
}

/**
 * The collection store reads reviewer mode, so every test states which audience
 * it is standing in. `reviewer: false` is what a tester gets.
 */
function renderStore(reviewer = false) {
  seedReviewerMode(reviewer);

  return renderHook(
    () => ({ collection: useCollection(), mode: useReviewerModeStore() }),
    { wrapper: Providers },
  );
}

/** Neither seeded as collected nor seeded as saved, so it starts clean. */
const unvisited = findPrototypeShop("juspirit-banqiao")!;

describe("collection scopes", () => {
  it("starts a normal device with nothing at all", () => {
    // The defect this guards: Milestone 1 opened every device on six stamps and
    // two saved shops, which Me and Passport then presented as the tester's own
    // history.
    const { result } = renderStore(false);

    expect(result.current.collection.scope).toBe("normal");
    expect(result.current.collection.savedShopIds.size).toBe(0);
    expect(result.current.collection.collections).toEqual([]);
    expect(result.current.collection.passport.stampCount).toBe(0);
    expect(result.current.collection.passport.countryCount).toBe(0);
    expect(result.current.collection.seals).toEqual([]);
  });

  it("starts reviewer mode from the seeded demonstration collection", () => {
    const { result } = renderStore(true);

    expect(result.current.collection.scope).toBe("reviewer");
    expect(result.current.collection.savedShopIds.size).toBeGreaterThan(0);
    expect(result.current.collection.passport.countryCount).toBe(3);
    expect(result.current.collection.isSaved(unvisited.id)).toBe(false);
    expect(result.current.collection.isVisited(unvisited.id)).toBe(false);
  });

  it("writes each mode to its own key", () => {
    const { result } = renderStore(false);

    act(() => {
      result.current.collection.toggleSaved(unvisited.id);
    });

    const normal = window.localStorage.getItem(COLLECTION_STORAGE_KEYS.normal);

    expect(normal).toContain(unvisited.id);
    expect(window.localStorage.getItem(COLLECTION_STORAGE_KEYS.reviewer)).toBeNull();
  });

  it("backfills a missing local-name language on an existing stamp", () => {
    const current = prototypeSeedCollections.find(
      (collection) => collection.shopLocalNameLangSnapshot !== undefined,
    );

    expect(current).toBeDefined();

    const {
      shopLocalNameLangSnapshot: removedLanguage,
      ...legacyCollection
    } = current!;

    expect(removedLanguage).toBeDefined();

    window.localStorage.setItem(
      COLLECTION_STORAGE_KEYS.normal,
      JSON.stringify({
        savedShopIds: [],
        collections: [legacyCollection],
        seals: [],
      }),
    );

    const { result } = renderStore(false);
    const hydrated = result.current.collection.collections[0];

    expect(hydrated?.shopSlug).toBe(current?.shopSlug);
    expect(hydrated?.shopLocalNameLangSnapshot).toBe(
      current?.shopLocalNameLangSnapshot,
    );
  });

  it("does not let a trip through reviewer mode touch a tester's own saves", () => {
    const { result } = renderStore(false);

    act(() => {
      result.current.collection.toggleSaved(unvisited.id);
    });
    expect(result.current.collection.isSaved(unvisited.id)).toBe(true);

    // Into reviewer mode: the seeded collection appears, and it is not the
    // tester's.
    act(() => {
      result.current.mode.setReviewer(true);
    });
    expect(result.current.collection.scope).toBe("reviewer");
    expect(result.current.collection.passport.countryCount).toBe(3);
    expect(result.current.collection.isSaved(unvisited.id)).toBe(false);

    // Back out: their own save is exactly as they left it, and no seeded stamp
    // followed them.
    act(() => {
      result.current.mode.setReviewer(false);
    });
    expect(result.current.collection.scope).toBe("normal");
    expect(result.current.collection.isSaved(unvisited.id)).toBe(true);
    expect(result.current.collection.passport.stampCount).toBe(0);
  });

  it("moves a Milestone 1 session into reviewer mode and out of normal mode", () => {
    const legacy = JSON.stringify({
      savedShopIds: [unvisited.id],
      collections: [],
      seals: [],
    });

    window.sessionStorage.setItem(LEGACY_COLLECTION_SESSION_KEY, legacy);

    const { result } = renderStore(false);

    // A staging session opened before this change must not keep showing its
    // seeded state as the tester's history.
    expect(result.current.collection.savedShopIds.size).toBe(0);
    expect(window.sessionStorage.getItem(LEGACY_COLLECTION_SESSION_KEY)).toBeNull();

    // It is not thrown away either: it was reviewer state, so that is where it
    // now lives.
    expect(window.localStorage.getItem(COLLECTION_STORAGE_KEYS.reviewer)).toBe(legacy);

    act(() => {
      result.current.mode.setReviewer(true);
    });
    expect(result.current.collection.isSaved(unvisited.id)).toBe(true);
  });

  it("never overwrites an existing reviewer store during migration", () => {
    const existing = JSON.stringify({ savedShopIds: [], collections: [], seals: [] });

    window.localStorage.setItem(COLLECTION_STORAGE_KEYS.reviewer, existing);
    window.sessionStorage.setItem(
      LEGACY_COLLECTION_SESSION_KEY,
      JSON.stringify({ savedShopIds: [unvisited.id], collections: [] }),
    );

    renderStore(false);

    expect(window.localStorage.getItem(COLLECTION_STORAGE_KEYS.reviewer)).toBe(existing);
    expect(window.sessionStorage.getItem(LEGACY_COLLECTION_SESSION_KEY)).toBeNull();
  });

  it("ignores a corrupt legacy blob rather than promoting it", () => {
    window.sessionStorage.setItem(LEGACY_COLLECTION_SESSION_KEY, "not json");

    renderStore(false);

    expect(window.sessionStorage.getItem(LEGACY_COLLECTION_SESSION_KEY)).toBeNull();
    expect(window.localStorage.getItem(COLLECTION_STORAGE_KEYS.reviewer)).toBeNull();
  });
});

describe("collection store", () => {
  it("derives seals from the seeded reviewer collection", () => {
    const { result } = renderStore(true);

    // Singapore's curated set holds two shops and both are seeded, so its
    // country seal is earned by completing a set smaller than five.
    expect(result.current.collection.countrySeal("SG")).toBeDefined();
    expect(result.current.collection.countrySeal("JP")).toBeUndefined();
    expect(result.current.collection.localitySeal("TW", "east-tainan")).toBeDefined();
  });

  it("keeps a seal earned in an earlier session", () => {
    const { result, unmount } = renderStore(true);

    expect(result.current.collection.countrySeal("SG")).toBeDefined();
    unmount();

    // A fresh provider rehydrates from the same reviewer store.
    const second = renderStore(true);

    expect(second.result.current.collection.countrySeal("SG")).toBeDefined();
  });

  it("toggles saving in both directions", () => {
    const { result } = renderStore();

    expect(result.current.collection.isSaved(unvisited.id)).toBe(false);

    act(() => {
      result.current.collection.toggleSaved(unvisited.id);
    });
    expect(result.current.collection.isSaved(unvisited.id)).toBe(true);

    act(() => {
      result.current.collection.toggleSaved(unvisited.id);
    });
    expect(result.current.collection.isSaved(unvisited.id)).toBe(false);
  });

  it("issues exactly one impression per shop", () => {
    const { result } = renderStore();
    const before = result.current.collection.passport.stampCount;

    act(() => {
      result.current.collection.collectStamp(unvisited, new Date("2026-08-18T02:00:00Z"));
    });

    const afterFirst = result.current.collection.passport.stampCount;
    expect(afterFirst).toBe(before + 1);
    expect(result.current.collection.isVisited(unvisited.id)).toBe(true);

    act(() => {
      result.current.collection.collectStamp(unvisited, new Date("2026-08-19T02:00:00Z"));
    });

    expect(result.current.collection.passport.stampCount).toBe(afterFirst);
  });

  it("returns the existing impression when collecting twice", () => {
    const { result } = renderStore();

    let first = "";
    act(() => {
      first = result.current.collection.collectStamp(
        unvisited,
        new Date("2026-08-18T02:00:00Z"),
      ).collectedOn;
    });

    let second = "";
    act(() => {
      second = result.current.collection.collectStamp(
        unvisited,
        new Date("2026-12-01T02:00:00Z"),
      ).collectedOn;
    });

    expect(second).toBe(first);
  });

  it("puts a newly collected impression into the right Passport locality", () => {
    const { result } = renderStore();
    const shop = findPrototypeShop("ty-lee-pen-shop")!;

    act(() => {
      result.current.collection.collectStamp(shop, new Date("2026-08-18T02:00:00Z"));
    });

    const taiwan = result.current.collection.passport.countries.find(
      (country) => country.slug === "tw",
    );
    const locality = taiwan?.localities.find(
      (candidate) => candidate.name === "Da'an, Taipei",
    );

    expect(locality?.collections.some((item) => item.shopId === shop.id)).toBe(true);
  });

  it("derives a locality seal from a newly collected first visit", () => {
    const { result } = renderStore();
    const shop = findPrototypeShop("ty-lee-pen-shop")!;

    expect(result.current.collection.localitySeal("TW", "daan-taipei")).toBeUndefined();

    act(() => {
      result.current.collection.collectStamp(shop, new Date("2026-08-18T02:00:00Z"));
    });

    expect(result.current.collection.localitySeal("TW", "daan-taipei")).toBeDefined();
  });

  it("restores the reviewer baseline on reset", () => {
    const { result } = renderStore(true);
    const seeded = result.current.collection.passport.stampCount;

    act(() => {
      result.current.collection.collectStamp(unvisited, new Date("2026-08-18T02:00:00Z"));
    });
    expect(result.current.collection.passport.stampCount).toBe(seeded + 1);

    act(() => {
      result.current.collection.resetPrototypeState();
    });
    expect(result.current.collection.passport.stampCount).toBe(seeded);
  });

  it("resets a normal device back to empty, not to the seed", () => {
    // The reset control is reviewer-only in the interface, but the store must
    // never hand a tester the demonstration collection.
    const { result } = renderStore(false);

    act(() => {
      result.current.collection.collectStamp(unvisited, new Date("2026-08-18T02:00:00Z"));
    });
    expect(result.current.collection.passport.stampCount).toBe(1);

    act(() => {
      result.current.collection.resetPrototypeState();
    });
    expect(result.current.collection.passport.stampCount).toBe(0);
    expect(result.current.collection.savedShopIds.size).toBe(0);
  });
});

describe("clearing local data", () => {
  it("removes saves and impressions from a normal device", () => {
    const { result } = renderStore(false);

    act(() => {
      result.current.collection.toggleSaved(unvisited.id);
      result.current.collection.collectStamp(unvisited);
    });

    expect(result.current.collection.passport.stampCount).toBe(1);
    window.localStorage.setItem(
      SAVED_SHOP_IMPORT_HOLDS_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        holds: [{ localId: unvisited.id, attempts: 1, lastTriedAt: Date.now() }],
      }),
    );

    act(() => {
      result.current.collection.clearLocalData();
    });

    expect(result.current.collection.savedShopIds.size).toBe(0);
    expect(result.current.collection.collections).toEqual([]);
    expect(result.current.collection.seals).toEqual([]);
    expect(result.current.collection.passport.stampCount).toBe(0);
    expect(
      window.localStorage.getItem(SAVED_SHOP_IMPORT_HOLDS_STORAGE_KEY),
    ).toBeNull();
  });

  /*
   * The failure this guards is specific to reviewer mode, whose *key absent*
   * baseline is the seeded demonstration collection. Clearing has to leave an
   * empty store on disk, not an absent one that reseeds six stamps on the next
   * visit — and it has to keep doing so when the reader clears twice.
   */
  it("leaves an empty store on disk rather than an absent one", () => {
    const { result } = renderStore(true);

    expect(result.current.collection.passport.stampCount).toBeGreaterThan(0);

    act(() => {
      result.current.collection.clearLocalData();
    });

    const afterFirst = window.localStorage.getItem(COLLECTION_STORAGE_KEYS.reviewer);

    expect(afterFirst).not.toBeNull();
    expect(JSON.parse(afterFirst!)).toMatchObject({
      savedShopIds: [],
      collections: [],
    });

    // Clearing an already-empty store changes no state, so nothing would be
    // written by the persistence effect. The key must still be there.
    act(() => {
      result.current.collection.clearLocalData();
    });

    expect(
      window.localStorage.getItem(COLLECTION_STORAGE_KEYS.reviewer),
    ).not.toBeNull();
  });

  it("is not the reviewer reset, which restores the seed", () => {
    const { result } = renderStore(true);

    act(() => {
      result.current.collection.clearLocalData();
    });

    expect(result.current.collection.passport.stampCount).toBe(0);

    act(() => {
      result.current.collection.resetPrototypeState();
    });

    expect(result.current.collection.passport.stampCount).toBeGreaterThan(0);
  });

  it("does not touch the other mode's store", () => {
    const { result } = renderStore(false);

    act(() => {
      result.current.collection.toggleSaved(unvisited.id);
    });

    window.localStorage.setItem(
      COLLECTION_STORAGE_KEYS.reviewer,
      JSON.stringify({ savedShopIds: ["kept"], collections: [] }),
    );

    act(() => {
      result.current.collection.clearLocalData();
    });

    expect(window.localStorage.getItem(COLLECTION_STORAGE_KEYS.reviewer)).toContain(
      "kept",
    );
  });
});

describe("another tab changing this store", () => {
  /**
   * Simulates a second tab writing to the same key.
   *
   * `storage` fires only in tabs that did *not* make the change, so dispatching
   * it by hand is exactly what a real second tab produces here.
   */
  function writeFromAnotherTab(scope: "normal" | "reviewer", state: unknown) {
    const key = COLLECTION_STORAGE_KEYS[scope];
    const newValue = JSON.stringify(state);

    window.localStorage.setItem(key, newValue);
    window.dispatchEvent(
      new StorageEvent("storage", {
        key,
        newValue,
        storageArea: window.localStorage,
      }),
    );
  }

  /*
   * The defect this guards is a promise being broken. Tab A clears and is told
   * the removal cannot be undone; tab B still holds the old arrays in React
   * state, and its persistence effect writes them straight back the next time
   * anything changes there. The collection returns, and the confirmation was a
   * lie.
   */
  it("does not resurrect a collection cleared in another tab", () => {
    const { result } = renderStore(false);

    act(() => {
      result.current.collection.toggleSaved(unvisited.id);
      result.current.collection.collectStamp(unvisited);
    });

    expect(result.current.collection.passport.stampCount).toBe(1);

    act(() => {
      writeFromAnotherTab("normal", {
        savedShopIds: [],
        collections: [],
        seals: [],
      });
    });

    expect(result.current.collection.collections).toEqual([]);
    expect(result.current.collection.savedShopIds.size).toBe(0);

    // The point of the test: a later change in this tab writes the *cleared*
    // state forward, not the state it was holding before.
    act(() => {
      result.current.collection.toggleSaved(unvisited.id);
    });

    const stored = JSON.parse(
      window.localStorage.getItem(COLLECTION_STORAGE_KEYS.normal)!,
    );

    expect(stored.collections).toEqual([]);
    expect(stored.savedShopIds).toEqual([unvisited.id]);
  });

  it("picks up a save made in another tab", () => {
    const { result } = renderStore(false);

    expect(result.current.collection.isSaved(unvisited.id)).toBe(false);

    act(() => {
      writeFromAnotherTab("normal", {
        savedShopIds: [unvisited.id],
        collections: [],
        seals: [],
      });
    });

    expect(result.current.collection.isSaved(unvisited.id)).toBe(true);
  });

  it("ignores the other mode's key", () => {
    const { result } = renderStore(false);

    act(() => {
      writeFromAnotherTab("reviewer", {
        savedShopIds: [unvisited.id],
        collections: prototypeSeedCollections,
        seals: [],
      });
    });

    expect(result.current.collection.savedShopIds.size).toBe(0);
    expect(result.current.collection.collections).toEqual([]);
  });

  /*
   * Every tab writes back what it adopts, which notifies every other tab in
   * turn. Without a guard on "we already hold this", two tabs would answer each
   * other indefinitely.
   */
  it("does not write back a value it just adopted", () => {
    const { result } = renderStore(false);

    act(() => {
      result.current.collection.toggleSaved(unvisited.id);
    });

    const setItem = vi.spyOn(Storage.prototype, "setItem");

    act(() => {
      writeFromAnotherTab("normal", {
        savedShopIds: [],
        collections: [],
        seals: [],
      });
    });

    // One write: the simulated other tab's own. Nothing echoed back.
    expect(
      setItem.mock.calls.filter(
        ([key]) => key === COLLECTION_STORAGE_KEYS.normal,
      ),
    ).toHaveLength(1);

    setItem.mockRestore();
  });
});

describe("prototype catalogue in the store", () => {
  it("exposes every prototype shop for the global Saved mode", () => {
    expect(prototypeShopDetails.length).toBeGreaterThan(0);
  });
});

describe("localCollectionDate", () => {
  it("uses the shop timezone snapshot, not the browser timezone", () => {
    // 2026-08-18T23:30Z is already 2026-08-19 in Tokyo and Singapore.
    const instant = new Date("2026-08-18T23:30:00Z");

    expect(localCollectionDate("Asia/Tokyo", instant)).toBe("2026-08-19");
    expect(localCollectionDate("Asia/Singapore", instant)).toBe("2026-08-19");
    expect(localCollectionDate("UTC", instant)).toBe("2026-08-18");
  });
});
