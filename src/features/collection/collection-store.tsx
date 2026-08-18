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

import { buildPassport, type PassportOverview, type StampCollection } from "@/src/domain/passport";
import type { ShopDetail } from "@/src/domain/shop-detail";
import type { UserShopState } from "@/src/domain/user-state";
import { demoSeedCollections, demoSeedSavedShopIds, toStampCollection } from "@/src/fixtures/demo-passport";

const STORAGE_KEY = "nib-atlas.demo-collection.v1";

interface PersistedState {
  readonly savedShopIds: readonly string[];
  readonly collections: readonly StampCollection[];
}

export interface CollectionStore {
  readonly savedShopIds: ReadonlySet<string>;
  readonly collections: readonly StampCollection[];
  readonly userShopState: UserShopState;
  readonly passport: PassportOverview;
  isSaved(shopId: string): boolean;
  isVisited(shopId: string): boolean;
  toggleSaved(shopId: string): boolean;
  collectionForShop(shopId: string): StampCollection | undefined;
  /** Idempotent: collecting twice returns the existing impression. */
  collectStamp(shop: ShopDetail, today?: Date): StampCollection;
  resetDemoState(): void;
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
  const [savedShopIds, setSavedShopIds] = useState<readonly string[]>(demoSeedSavedShopIds);
  const [collections, setCollections] = useState<readonly StampCollection[]>(demoSeedCollections);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const persisted = readPersisted();

    /* eslint-disable react-hooks/set-state-in-effect --
       Session storage is an external system that can only be read after mount;
       this is the documented "subscribe to an external store" case. */
    if (persisted) {
      setSavedShopIds(persisted.savedShopIds);
      setCollections(persisted.collections);
    }

    setHydrated(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  useEffect(() => {
    if (!hydrated || typeof window === "undefined") {
      return;
    }

    try {
      window.sessionStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ savedShopIds, collections } satisfies PersistedState),
      );
    } catch {
      // Storage is best-effort for the demo.
    }
  }, [collections, hydrated, savedShopIds]);

  const savedSet = useMemo(() => new Set(savedShopIds), [savedShopIds]);
  const visitedSet = useMemo(
    () => new Set(collections.map((collection) => collection.shopId)),
    [collections],
  );

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

  const collectStamp = useCallback((shop: ShopDetail, today: Date = new Date()) => {
    const existing = collections.find((collection) => collection.shopId === shop.id);

    if (existing) {
      return existing;
    }

    const issued = toStampCollection(shop, localCollectionDate(shop.timezone, today));

    setCollections((current) =>
      current.some((collection) => collection.shopId === shop.id)
        ? current
        : [...current, issued],
    );

    return issued;
  }, [collections]);

  const resetDemoState = useCallback(() => {
    setSavedShopIds(demoSeedSavedShopIds);
    setCollections(demoSeedCollections);
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
      isSaved: (shopId: string) => savedSet.has(shopId),
      isVisited: (shopId: string) => visitedSet.has(shopId),
      toggleSaved,
      collectionForShop: (shopId: string) =>
        collections.find((collection) => collection.shopId === shopId),
      collectStamp,
      resetDemoState,
    };
  }, [collectStamp, collections, resetDemoState, savedSet, toggleSaved, visitedSet]);

  return <CollectionContext.Provider value={value}>{children}</CollectionContext.Provider>;
}

export function useCollection(): CollectionStore {
  const store = useContext(CollectionContext);

  if (!store) {
    throw new Error("useCollection must be used inside CollectionProvider");
  }

  return store;
}
