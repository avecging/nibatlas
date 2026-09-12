"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
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
import {
  designSeal,
  prototypeCoverageSets,
  prototypeShopDetails,
} from "@/src/fixtures/prototype-catalogue";
import {
  prototypeSeedCollections,
  prototypeSeedSavedShopIds,
  toStampCollection,
} from "@/src/fixtures/prototype-passport";
import { useReviewerModeStore } from "@/src/features/reviewer/ReviewerModeProvider";
import { clearUnknownShopImportHolds } from "@/src/features/saved/saved-shop-import-holds";
import { useCatalogue } from "@/src/features/catalogue/CatalogueProvider";
import { useAccountSession } from "@/src/features/account/AccountSessionProvider";
import { fetchCollections } from "./collection-client";

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
 * true. Account-backed saves replace only the saved identifiers after a safe
 * reconciliation; stamp collections and carried seals remain device-local.
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

/**
 * One canonical serialisation, used by every write and every comparison.
 *
 * The cross-tab listener below decides whether to adopt an incoming value by
 * comparing strings, so "the same state" has to produce the same bytes wherever
 * it is written from — key order included.
 */
function serializeState(state: PersistedState): string {
  return JSON.stringify({
    savedShopIds: state.savedShopIds,
    collections: state.collections,
    seals: state.seals ?? [],
  } satisfies PersistedState);
}

/** What a scope holds before anyone has touched it. */
function baselineFor(scope: CollectionScope): PersistedState {
  return scope === "reviewer"
    ? { savedShopIds: prototypeSeedSavedShopIds, collections: prototypeSeedCollections }
    : { savedShopIds: [], collections: [] };
}

export interface CollectionStore {
  readonly source?: 'account';
  readonly readStatus?: 'loading' | 'ready' | 'error' | 'signed-out' | 'unavailable';
  readonly accountOwner?: string | null;
  retryRead?(): void;
  acceptIssued?(collection: StampCollection): void;
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
  /** Removes only identifiers that an account import safely reconciled or skipped. */
  retireSavedShopIds(shopIds: readonly string[]): void;
  collectionForShop(shopId: string): StampCollection | undefined;
  localitySeal(countryCode: CountryCode, localitySlug: string): EarnedSeal | undefined;
  countrySeal(countryCode: CountryCode): EarnedSeal | undefined;
  /** Idempotent: collecting twice returns the existing impression. */
  collectStamp(shop: ShopDetail, today?: Date): StampCollection;
  /** Restores the current scope's baseline. Reviewer-only in the interface. */
  resetPrototypeState(): void;
  /**
   * Empties this device's store, in place.
   *
   * The key is *written as empty*, not removed: an absent key is a scope's cue
   * to fall back to its baseline, and on a reviewer device that baseline is the
   * seeded demonstration collection. Removing it would reseed six stamps on the
   * next visit.
   *
   * Distinct from {@link CollectionStore.resetPrototypeState}, which restores
   * that baseline deliberately. Clearing removes: no saves, no impressions, no
   * carried seals.
   *
   * Scoped to this store alone. It is not a device wipe — the reviewer-mode
   * choice, the account preview and anything else the browser holds are
   * untouched — so copy describing it must name the two things it removes
   * rather than claim the device is now clean.
   */
  clearLocalData(): void;
}

const CollectionContext = createContext<CollectionStore | null>(null);

const localNameLanguageByShopSlug = new Map(
  prototypeShopDetails.flatMap((shop) =>
    shop.localNameLang === undefined ? [] : [[shop.slug, shop.localNameLang] as const],
  ),
);

/**
 * Backfills language metadata introduced after collections were already stored.
 *
 * A collection is a durable snapshot, so current records never overwrite an
 * existing snapshot. Only the missing field is recovered, by stable shop slug,
 * from the sourced catalogue that originally issued the prototype stamp.
 */
function enrichLegacyCollection(collection: StampCollection): StampCollection {
  if (
    collection.shopLocalNameSnapshot === undefined ||
    collection.shopLocalNameLangSnapshot !== undefined
  ) {
    return collection;
  }

  const language = localNameLanguageByShopSlug.get(collection.shopSlug);

  return language === undefined
    ? collection
    : { ...collection, shopLocalNameLangSnapshot: language };
}

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

    const state = parsed as PersistedState;

    return {
      ...state,
      collections: state.collections.map(enrichLegacyCollection),
    };
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
  const catalogue = useCatalogue();
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
  /**
   * The last value this tab wrote, verbatim.
   *
   * Writing to `localStorage` notifies every *other* tab, and each of those
   * will write the adopted value back. Without this the two would answer each
   * other indefinitely; with it, a tab ignores a value it already holds.
   */
  const lastWrittenRef = useRef<string | null>(null);

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

    const serialized = serializeState({
      savedShopIds,
      collections,
      seals: derived.seals,
    });

    // Nothing changed — usually because this state was just adopted from
    // another tab. Writing it back would bounce the event straight home.
    if (serialized === lastWrittenRef.current) {
      return;
    }

    try {
      window.localStorage.setItem(STORAGE_KEYS[scope], serialized);
      lastWrittenRef.current = serialized;
    } catch {
      // Storage is best-effort; the collection still works for this page view.
    }
  }, [collections, derived.seals, hydratedFor, savedShopIds, scope]);

  /**
   * Adopt what another tab did to this store.
   *
   * Without this, two open tabs drift apart and the *stale* one wins. Clear
   * data on this device is the case that matters: tab A clears and is told the
   * removal cannot be undone, tab B still holds the old arrays in React state,
   * and the next save or collection in tab B writes them straight back — the
   * collection returns, and the confirmation was a lie. A save made in one tab
   * going missing in another is the same defect, quieter.
   *
   * `storage` fires only in the tabs that did *not* make the change, so this
   * never runs against its own write; `lastWrittenRef` covers the echo that
   * comes back once the other tab persists what it adopted.
   */
  useEffect(() => {
    if (hydratedFor !== scope || typeof window === "undefined") {
      return;
    }

    function onStorage(event: StorageEvent) {
      // A null key is `localStorage.clear()` — the whole area went, this
      // store with it.
      if (event.key !== null && event.key !== STORAGE_KEYS[scope]) {
        return;
      }

      if (event.storageArea && event.storageArea !== window.localStorage) {
        return;
      }

      const next = readScope(scope) ?? baselineFor(scope);
      const serialized = serializeState(next);

      if (serialized === lastWrittenRef.current) {
        return;
      }

      lastWrittenRef.current = serialized;
      setSavedShopIds(next.savedShopIds);
      setCollections(next.collections);
      setCarriedSeals(next.seals ?? []);
    }

    window.addEventListener("storage", onStorage);

    return () => {
      window.removeEventListener("storage", onStorage);
    };
  }, [hydratedFor, scope]);

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

  const retireSavedShopIds = useCallback((shopIds: readonly string[]) => {
    if (shopIds.length === 0) {
      return;
    }

    const retired = new Set(shopIds);
    setSavedShopIds((current) => current.filter((id) => !retired.has(id)));
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
    const serialized = serializeState({
      savedShopIds: [],
      collections: [],
      seals: [],
    });

    try {
      window.localStorage.setItem(STORAGE_KEYS[scope], serialized);
      lastWrittenRef.current = serialized;

      if (scope === "normal") {
        clearUnknownShopImportHolds();
      }
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
      retireSavedShopIds,
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
    retireSavedShopIds,
    savedSet,
    scope,
    toggleSaved,
    visitedSet,
  ]);

  if (resolved && !catalogue.simulatedCollection && !reviewer) {
    return <AccountCollectionBoundary local={value}>{children}</AccountCollectionBoundary>;
  }
  return <CollectionContext.Provider value={value}>{children}</CollectionContext.Provider>;
}

/** Remount all private state on identity change, including pending response guards. */
function AccountCollectionBoundary({ local, children }: { readonly local: CollectionStore; readonly children: ReactNode }) {
  const { session } = useAccountSession();
  const owner = session.status === 'signed-in' ? session.userId : null;
  return <AccountCollections key={owner ?? session.status} owner={owner} local={local}>{children}</AccountCollections>;
}

function AccountCollections({ owner, local, children }: {
  readonly owner: string | null; readonly local: CollectionStore; readonly children: ReactNode;
}) {
  const { session, refresh } = useAccountSession();
  const [collections, setCollections] = useState<readonly StampCollection[]>([]);
  const [readStatus, setReadStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [revision, setRevision] = useState(0);
  const active = useRef(true);
  const issued = useRef(new Map<string, StampCollection>());
  const retryRead = useCallback(() => setRevision(value => value + 1), []);
  useEffect(() => {
    active.current = true;
    const pendingIssued = issued.current;
    return () => { active.current = false; pendingIssued.clear(); };
  }, []);
  useEffect(() => {
    if (!owner) return;
    const controller = new AbortController();
    void fetchCollections(controller.signal, owner).then(rows => {
      if (controller.signal.aborted) return;
      // A read started before issuance cannot erase the newly issued impression.
      const merged = new Map(rows.map(row => [row.id, row]));
      for (const [id, row] of issued.current) if (!merged.has(id)) merged.set(id, row);
      setCollections([...merged.values()]);
      setReadStatus('ready');
    }).catch(() => {
      if (!controller.signal.aborted) setReadStatus('error');
    });
    return () => controller.abort();
  }, [owner, revision]);
  useEffect(() => {
    if (!owner) return;
    const onVisible = () => {
      if (document.visibilityState === 'visible') { refresh(); retryRead(); }
    };
    const channel = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel('nib-atlas.collections');
    if (channel) channel.onmessage = () => { refresh(); retryRead(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { channel?.close(); document.removeEventListener('visibilitychange', onVisible); };
  }, [owner, refresh, retryRead]);
  const acceptIssued = useCallback((collection: StampCollection) => {
    if (!active.current || !owner || collection.simulated) return;
    issued.current.set(collection.id, collection);
    setCollections(current => [...current.filter(row => row.id !== collection.id), collection]);
    setReadStatus('ready');
    retryRead();
    // Invalidation contains no identity, collection, coordinates or nonce.
    if (typeof BroadcastChannel !== 'undefined') {
      const channel = new BroadcastChannel('nib-atlas.collections');
      channel.postMessage('changed'); channel.close();
    }
  }, [owner, retryRead]);
  const visited = useMemo(() => new Set(collections.map(row => row.shopId)), [collections]);
  const value: CollectionStore = {
    ...local, source:'account', accountOwner:owner, collections,
    readStatus: owner ? readStatus : session.status === 'signed-out' ? 'signed-out'
      : session.status === 'loading' ? 'loading' : 'unavailable',
    hydrated: owner ? readStatus === 'ready' || collections.length > 0 : session.status === 'signed-out',
    passport:buildPassport(collections),
    // Geographic awards need their own persisted/versioned backend (deferred).
    seals:[],countryProgress:[],localitySeal:() => undefined,countrySeal:() => undefined,
    userShopState:{ savedShopIds:local.savedShopIds,visitedShopIds:visited },
    isVisited:id => visited.has(id), collectionForShop:id => collections.find(row => row.shopId === id),
    collectStamp:() => { throw new Error('Verified issuance required'); }, retryRead:() => {refresh();retryRead();},acceptIssued,
  };
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
