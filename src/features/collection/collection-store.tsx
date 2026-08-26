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

const STORAGE_KEY = "nib-atlas.prototype-collection.v2";

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

export interface CollectionStore {
  readonly savedShopIds: ReadonlySet<string>;
  readonly collections: readonly StampCollection[];
  readonly userShopState: UserShopState;
  readonly passport: PassportOverview;
  readonly seals: readonly EarnedSeal[];
  readonly countryProgress: readonly CountrySealProgress[];
  isSaved(shopId: string): boolean;
  isVisited(shopId: string): boolean;
  toggleSaved(shopId: string): boolean;
  collectionForShop(shopId: string): StampCollection | undefined;
  localitySeal(countryCode: CountryCode, localitySlug: string): EarnedSeal | undefined;
  countrySeal(countryCode: CountryCode): EarnedSeal | undefined;
  /** Idempotent: collecting twice returns the existing impression. */
  collectStamp(shop: ShopDetail, today?: Date): StampCollection;
  resetPrototypeState(): void;
}

const CollectionContext = createContext<CollectionStore | null>(null);

function readPersisted(): PersistedState | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }

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

export function localCollectionDate(timezone: string, today: Date): string {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(today);
  } catch {
    return new Intl.DateTimeFormat("en-CA").format(today);
  }
}

export function CollectionProvider({ children }: { readonly children: ReactNode }) {
  const [savedShopIds, setSavedShopIds] = useState<readonly string[]>(
    prototypeSeedSavedShopIds,
  );
  const [collections, setCollections] = useState<readonly StampCollection[]>(
    prototypeSeedCollections,
  );
  const [carriedSeals, setCarriedSeals] = useState<readonly EarnedSeal[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const persisted = readPersisted();

    /* eslint-disable react-hooks/set-state-in-effect --
       Session storage is an external system that can only be read after mount;
       this is the documented "subscribe to an external store" case. */
    if (persisted) {
      setSavedShopIds(persisted.savedShopIds);
      setCollections(persisted.collections);
      setCarriedSeals(persisted.seals ?? []);
    }

    setHydrated(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

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
    if (!hydrated || typeof window === "undefined") {
      return;
    }

    try {
      window.sessionStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          savedShopIds,
          collections,
          seals: derived.seals,
        } satisfies PersistedState),
      );
    } catch {
      // Storage is best-effort for the prototype.
    }
  }, [collections, derived.seals, hydrated, savedShopIds]);

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
    setSavedShopIds(prototypeSeedSavedShopIds);
    setCollections(prototypeSeedCollections);
    setCarriedSeals([]);
  }, []);

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
    };
  }, [
    collectStamp,
    collections,
    derived.countryProgress,
    derived.seals,
    resetPrototypeState,
    savedSet,
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
