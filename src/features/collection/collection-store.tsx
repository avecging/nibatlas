"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  buildPassport,
  type PassportOverview,
  type StampCollection,
} from "@/src/domain/passport";
import {
  countrySealFor,
  deriveSeals,
  localitySealFor,
  type CountrySealProgress,
  type EarnedSeal,
} from "@/src/domain/seals";
import type { ShopDetail } from "@/src/domain/shop-detail";
import type { CountryCode } from "@/src/domain/geo";
import type { UserShopState } from "@/src/domain/user-state";
import { designSeal, prototypeCoverageSets } from "@/src/fixtures/prototype-catalogue";
import {
  prototypeSeedCollections,
  prototypeSeedSavedShopIds,
  toStampCollection,
} from "@/src/fixtures/prototype-passport";
import { useReviewerModeStore } from "@/src/features/reviewer/ReviewerModeProvider";

/**
 * Local collection state, namespaced by mode.
 *
 * Milestone 1 opened every device on `prototypeSeedCollections`: six stamps
 * across three countries and two saved shops, present before the tester had
 * done anything. On the reviewer's screen that is a demonstration fixture. On a
 * tester's screen it is six places they are being told they have visited —
 * Me and Passport present it as their own history, which reads as though
 * something had been tracking them.
 *
 * So the two audiences get two stores:
 *
 * - **normal** starts empty. Everything in it was put there by the person using
 *   it.
 * - **reviewer** starts from the seed, because the seal rules, the Passport
 *   pagination and the ceremony cannot be reviewed against an empty collection.
 *
 * Separate keys rather than one key plus a flag, so switching modes can never
 * overwrite or reinterpret the other mode's contents: a tester's real saves
 * survive a trip through reviewer mode untouched, and the seed can never be
 * mistaken for them.
 *
 * `localStorage`, not `sessionStorage`: Me and Privacy now tell the reader their
 * saves stay on the device until they clear browser data, and that has to be
 * true. Milestone 5 replaces all of this with server-issued rows.
 */
export type CollectionScope = "normal" | "reviewer";

const STORAGE_KEYS: Record<CollectionScope, string> = {
  normal: "nib-atlas.collection.v3",
  reviewer: "nib-atlas.collection.reviewer.v3",
};

/**
 * Milestone 1's single session key.
 *
 * It only ever held seeded demonstration state, so it belongs to reviewer mode.
 * It is moved there once and removed, which is what stops a staging session
 * opened before this change from carrying the seed into normal mode and going on
 * looking like the tester's own history.
 */
const LEGACY_SESSION_KEY = "nib-atlas.prototype-collection.v2";

interface PersistedState {
  readonly savedShopIds: readonly string[];
  readonly collections: readonly StampCollection[];
  /**
   * Persisted separately from the collections so an earned seal survives a
   * coverage-set version bump. Recomputing seals from collections alone would
   * revoke a country seal the moment the curated set grew past its old size,
   * which `PRODUCT.md` forbids.
   */
  readonly seals?: readonly EarnedSeal[];
}

/** What a scope holds before anyone has touched it. */
function baselineFor(scope: CollectionScope): PersistedState {
  return scope === "reviewer"
    ? { savedShopIds: prototypeSeedSavedShopIds, collections: prototypeSeedCollections }
    : { savedShopIds: [], collections: [] };
}

export interface CollectionStore {
  readonly savedShopIds: ReadonlySet<string>;
  readonly collections: readonly StampCollection[];
  readonly userShopState: UserShopState;
  readonly passport: PassportOverview;
  readonly seals: readonly EarnedSeal[];
  readonly countryProgress: readonly CountrySealProgress[];
  /** Which store is in use, so tests and diagnostics can name it. */
  readonly scope: CollectionScope;
  /**
   * Whether the device's own state has been read yet.
   *
   * False during the server render and the first client paint. Anything that
   * makes a *claim* about the reader's history — "Your Passport is empty",
   * "Nothing saved yet", "No visits yet" — must wait for this, or a returning
   * user is told their collection is gone for one frame. The counts themselves
   * may render from the empty baseline; a statement may not.
   */
  readonly hydrated: boolean;
  isSaved(shopId: string): boolean;
  isVisited(shopId: string): boolean;
  toggleSaved(shopId: string): boolean;
  collectionForShop(shopId: string): StampCollection | undefined;
  localitySeal(countryCode: CountryCode, localitySlug: string): EarnedSeal | undefined;
  countrySeal(countryCode: CountryCode): EarnedSeal | undefined;
  /** Idempotent: collecting twice returns the existing impression. */
  collectStamp(shop: ShopDetail, today?: Date): StampCollection;
  /** Restores the current scope's baseline. Reviewer-only in the interface. */
  resetPrototypeState(): void;
  /**
   * Empties this device's store and removes its key.
   *
   * Distinct from {@link CollectionStore.resetPrototypeState}, which restores a
   * baseline — on a reviewer device that baseline is the seeded demonstration
   * collection, so reset *adds* six stamps back. **Clear data on this device**
   * in Me promises removal, so it has to remove: no saves, no impressions, no
   * carried seals, and no leftover key for the next visit to read.
   */
  clearLocalData(): void;
}

const CollectionContext = createContext<CollectionStore | null>(null);

function parsePersisted(raw: string | null): PersistedState | null {
  if (!raw) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(raw);

    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !Array.isArray((parsed as PersistedState).savedShopIds) ||
      !Array.isArray((parsed as PersistedState).collections)
    ) {
      return null;
    }

    return parsed as PersistedState;
  } catch {
    return null;
  }
}

/**
 * Retires Milestone 1's session key.
 *
 * Idempotent and best effort: the key is removed whether or not the reviewer
 * store accepts it, because leaving it in place is the failure mode that
 * matters. An existing reviewer store is never overwritten.
 */
export function migrateLegacyPrototypeSession(): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    const raw = window.sessionStorage.getItem(LEGACY_SESSION_KEY);

    if (raw === null) {
      return;
    }

    window.sessionStorage.removeItem(LEGACY_SESSION_KEY);

    if (
      parsePersisted(raw) !== null &&
      window.localStorage.getItem(STORAGE_KEYS.reviewer) === null
    ) {
      window.localStorage.setItem(STORAGE_KEYS.reviewer, raw);
    }
  } catch {
    // Storage can be unavailable. Normal mode still starts empty, which is the
    // property this migration exists to guarantee.
  }
}

function readScope(scope: CollectionScope): PersistedState | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return parsePersisted(window.localStorage.getItem(STORAGE_KEYS[scope]));
  } catch {
    return null;
  }
}

export function localCollectionDate(timezone: string, today: Date): string {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(today);
  } catch {
    return new Intl.DateTimeFormat("en-CA").format(today);
  }
}

export function CollectionProvider({ children }: { readonly children: ReactNode }) {
  const { reviewer, resolved } = useReviewerModeStore();
  const scope: CollectionScope = reviewer ? "reviewer" : "normal";

  /*
   * The server render and the first client paint are the empty normal store.
   * That is both halves of the requirement at once: the two renders agree, and
   * the state a tester's browser paints first is the one they actually own.
   */
  const [savedShopIds, setSavedShopIds] = useState<readonly string[]>([]);
  const [collections, setCollections] = useState<readonly StampCollection[]>([]);
  const [carriedSeals, setCarriedSeals] = useState<readonly EarnedSeal[]>([]);
  const [hydratedFor, setHydratedFor] = useState<CollectionScope | null>(null);

  useEffect(() => {
    // Reviewer mode resolves after mount, so loading before it settles would
    // read the wrong store and — worse — persist it back over the right one.
    if (!resolved || hydratedFor === scope) {
      return;
    }

    migrateLegacyPrototypeSession();

    const persisted = readScope(scope) ?? baselineFor(scope);

    /* eslint-disable react-hooks/set-state-in-effect --
       Local storage is an external system that can only be read after mount;
       this is the documented "subscribe to an external store" case. */
    setSavedShopIds(persisted.savedShopIds);
    setCollections(persisted.collections);
    setCarriedSeals(persisted.seals ?? []);
    setHydratedFor(scope);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [hydratedFor, resolved, scope]);

  const savedSet = useMemo(() => new Set(savedShopIds), [savedShopIds]);
  const visitedSet = useMemo(
    () => new Set(collections.map((collection) => collection.shopId)),
    [collections],
  );

  const derived = useMemo(
    () =>
      deriveSeals({
        collections,
        coverageSets: prototypeCoverageSets,
        alreadyEarned: carriedSeals,
        designSeal,
      }),
    [carriedSeals, collections],
  );

  useEffect(() => {
    // Only ever write the scope this state was actually loaded from. Writing
    // during a mode change would put one audience's collection into the other's
    // store.
    if (hydratedFor !== scope || typeof window === "undefined") {
      return;
    }

    try {
      window.localStorage.setItem(
        STORAGE_KEYS[scope],
        JSON.stringify({
          savedShopIds,
          collections,
          seals: derived.seals,
        } satisfies PersistedState),
      );
    } catch {
      // Storage is best-effort; the collection still works for this page view.
    }
  }, [collections, derived.seals, hydratedFor, savedShopIds, scope]);

  const toggleSaved = useCallback((shopId: string) => {
    let nextSaved = false;

    setSavedShopIds((current) => {
      if (current.includes(shopId)) {
        nextSaved = false;
        return current.filter((id) => id !== shopId);
      }

      nextSaved = true;
      return [...current, shopId];
    });

    return nextSaved;
  }, []);

  const collectStamp = useCallback(
    (shop: ShopDetail, today: Date = new Date()) => {
      const existing = collections.find((collection) => collection.shopId === shop.id);

      if (existing) {
        return existing;
      }

      const issued = toStampCollection(
        shop,
        localCollectionDate(shop.timezone, today),
      );

      setCollections((current) =>
        current.some((collection) => collection.shopId === shop.id)
          ? current
          : [...current, issued],
      );

      return issued;
    },
    [collections],
  );

  const resetPrototypeState = useCallback(() => {
    const baseline = baselineFor(scope);

    setSavedShopIds(baseline.savedShopIds);
    setCollections(baseline.collections);
    setCarriedSeals([]);
  }, [scope]);

  const clearLocalData = useCallback(() => {
    setSavedShopIds([]);
    setCollections([]);
    setCarriedSeals([]);

    // Written here rather than left to the persistence effect, which only runs
    // when the state actually changes. On a reviewer device that already holds
    // an empty store, clearing again would change nothing, write nothing, and —
    // if this removed the key instead — leave *absent*, whose baseline is the
    // seeded collection. Clearing must leave an empty store behind, never an
    // absent one that reseeds on the next visit.
    try {
      window.localStorage.setItem(
        STORAGE_KEYS[scope],
        JSON.stringify({
          savedShopIds: [],
          collections: [],
          seals: [],
        } satisfies PersistedState),
      );
    } catch {
      // Storage is best effort; the in-memory state is already empty.
    }
  }, [scope]);

  const value = useMemo<CollectionStore>(() => {
    const userShopState: UserShopState = {
      savedShopIds: savedSet,
      visitedShopIds: visitedSet,
    };

    return {
      savedShopIds: savedSet,
      collections,
      userShopState,
      passport: buildPassport(collections),
      seals: derived.seals,
      countryProgress: derived.countryProgress,
      scope,
      hydrated: hydratedFor === scope,
      isSaved: (shopId: string) => savedSet.has(shopId),
      isVisited: (shopId: string) => visitedSet.has(shopId),
      toggleSaved,
      collectionForShop: (shopId: string) =>
        collections.find((collection) => collection.shopId === shopId),
      localitySeal: (countryCode: CountryCode, localitySlug: string) =>
        localitySealFor(derived.seals, countryCode, localitySlug),
      countrySeal: (countryCode: CountryCode) =>
        countrySealFor(derived.seals, countryCode),
      collectStamp,
      resetPrototypeState,
      clearLocalData,
    };
  }, [
    clearLocalData,
    collectStamp,
    collections,
    derived.countryProgress,
    derived.seals,
    hydratedFor,
    resetPrototypeState,
    savedSet,
    scope,
    toggleSaved,
    visitedSet,
  ]);

  return <CollectionContext.Provider value={value}>{children}</CollectionContext.Provider>;
}

export function useCollection(): CollectionStore {
  const store = useContext(CollectionContext);

  if (!store) {
    throw new Error("useCollection must be used inside CollectionProvider");
  }

  return store;
}

/** Exported for tests and for the reviewer diagnostics that name the store. */
export const COLLECTION_STORAGE_KEYS = STORAGE_KEYS;
export const LEGACY_COLLECTION_SESSION_KEY = LEGACY_SESSION_KEY;
