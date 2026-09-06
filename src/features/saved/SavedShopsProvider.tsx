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

import type { SavedShopV1 } from "@/src/api/v1/saved-shops";
import styles from "@/src/features/saved/SavedShopsProvider.module.css";
import { useAccountSession } from "@/src/features/account/AccountSessionProvider";
import { useSignInPrompt } from "@/src/features/auth/SignInProvider";
import { useCollection } from "@/src/features/collection/collection-store";
import { prototypeShopById } from "@/src/fixtures/prototype-catalogue";
import {
  completePendingSave,
  fetchSavedShops,
  importLocalSavedShops,
  setSavedShop,
  type SavedShopClientFailure,
} from "@/src/features/saved/saved-shops-client";
import {
  backedOffUnknownShopIds,
  recordUnknownShopImportHolds,
  releaseUnknownShopImportHolds,
} from "@/src/features/saved/saved-shop-import-holds";

export type SavedShopsStatus = "local" | "loading" | "ready" | "error";

export interface SavedShopsStore {
  readonly savedShopIds: ReadonlySet<string>;
  readonly shops: readonly SavedShopV1[];
  readonly pendingShopIds: ReadonlySet<string>;
  readonly status: SavedShopsStatus;
  readonly hydrated: boolean;
  readonly failure: SavedShopClientFailure | null;
  isSaved(shopId: string): boolean;
  toggleSaved(shopId: string, shopName?: string): void;
  retry(): void;
}

const SavedShopsContext = createContext<SavedShopsStore | null>(null);

interface ImportReport {
  readonly userId: string;
  readonly reconciled: number;
  readonly invalid: number;
  readonly unknown: number;
  readonly failed: number;
}

interface AccountSaves {
  readonly userId: string;
  readonly ids: readonly string[];
  readonly shops: readonly SavedShopV1[];
}

const EMPTY_ACCOUNT_SAVES: AccountSaves = {
  userId: "",
  ids: [],
  shops: [],
};

function failureMessage(failure: SavedShopClientFailure): string {
  if (failure === "authentication-required") {
    return "Your session changed before that save finished. Please sign in again.";
  }

  if (failure === "shop-not-found") {
    return "That shop is no longer available to save.";
  }

  return "Saved shops could not be updated. Your previous saved state has been restored.";
}

/**
 * Owns the transition from device-local prototype saves to account-backed saves.
 *
 * WP5A deliberately does not import or delete the local store. A signed-out
 * reader still sees legitimate existing device-local choices; once signed in,
 * only the owner-scoped service is rendered and mutated. WP5B can therefore
 * import the untouched local identifiers without trying to recover data that
 * this provider has overwritten.
 */
export function SavedShopsProvider({ children }: { readonly children: ReactNode }) {
  const collection = useCollection();
  const account = useAccountSession();
  const { requestSignIn } = useSignInPrompt();
  const [accountSaves, setAccountSaves] =
    useState<AccountSaves>(EMPTY_ACCOUNT_SAVES);
  const [failure, setFailure] = useState<SavedShopClientFailure | null>(null);
  const [pendingShopIds, setPendingShopIds] = useState<ReadonlySet<string>>(
    () => new Set<string>(),
  );
  const [reloadToken, setReloadToken] = useState(0);
  const [importBatchToken, setImportBatchToken] = useState(0);
  const [importReport, setImportReport] = useState<ImportReport | null>(null);
  const [importFailure, setImportFailure] =
    useState<SavedShopClientFailure | null>(null);
  const readToken = useRef(0);
  const completionAttempt = useRef<string | null>(null);
  const completionRefreshAttempt = useRef<string | null>(null);
  const importAttempt = useRef<string | null>(null);
  const importRefreshAttempt = useRef<string | null>(null);
  const importOwner = useRef<string | null>(null);
  const heldImportIds = useRef(new Set<string>());
  const forcedImportReload = useRef<number | null>(null);
  const mutationTokens = useRef(new Map<string, number>());

  const signedInUserId =
    account.session.status === "signed-in" ? account.session.userId : null;
  const localMode =
    account.session.status === "signed-out" ||
    (account.session.status === "unavailable" &&
      account.session.reason === "not-configured");
  const accountReady =
    signedInUserId !== null && accountSaves.userId === signedInUserId;

  useEffect(() => {
    if (signedInUserId === null) {
      return;
    }

    const token = readToken.current + 1;
    readToken.current = token;
    const controller = new AbortController();

    void fetchSavedShops(controller.signal).then((result) => {
      if (readToken.current !== token || controller.signal.aborted) {
        return;
      }

      if (!result.ok) {
        setFailure(result.reason);

        if (result.reason === "authentication-required") {
          account.refresh();
        }

        return;
      }

      setFailure(null);
      setAccountSaves({
        userId: signedInUserId,
        ids: result.value.savedShopIds,
        shops: result.value.shops,
      });
    });

    return () => controller.abort();
  }, [account, reloadToken, signedInUserId]);

  useEffect(() => {
    if (!accountReady || signedInUserId === null) {
      completionAttempt.current = null;

      if (signedInUserId === null) {
        completionRefreshAttempt.current = null;
      }

      return;
    }

    const attempt = `${signedInUserId}:${reloadToken}`;

    if (completionAttempt.current === attempt) {
      return;
    }

    completionAttempt.current = attempt;

    void completePendingSave().then((result) => {
      if (completionAttempt.current !== attempt) {
        return;
      }

      if (!result.ok) {
        setFailure(result.reason);

        if (
          result.reason === "authentication-required" &&
          completionRefreshAttempt.current !== attempt
        ) {
          // Give an expired provider session one automatic refresh/retry per
          // attempt. A persistent 401 remains an honest error instead of
          // becoming an unbounded refresh loop; manual Retry advances the key.
          completionRefreshAttempt.current = attempt;
          completionAttempt.current = null;
          account.refresh();
        }

        return;
      }

      completionRefreshAttempt.current = null;

      if (!result.value?.shop) {
        return;
      }

      const completed = result.value.shop;

      setFailure(null);
      setAccountSaves((current) => ({
        ...current,
        ids: current.ids.includes(completed.id)
          ? current.ids
          : [...current.ids, completed.id],
        shops: [
          ...current.shops.filter((shop) => shop.id !== completed.id),
          completed,
        ],
      }));
    });
  }, [account, accountReady, reloadToken, signedInUserId]);

  useEffect(() => {
    if (
      !accountReady ||
      signedInUserId === null ||
      !collection.hydrated ||
      collection.scope !== "normal"
    ) {
      if (signedInUserId === null) {
        importAttempt.current = null;
        importRefreshAttempt.current = null;
        importOwner.current = null;
        heldImportIds.current.clear();
        forcedImportReload.current = null;
      }

      return;
    }

    if (importOwner.current !== signedInUserId) {
      importOwner.current = signedInUserId;
      importAttempt.current = null;
      importRefreshAttempt.current = null;
      heldImportIds.current.clear();
      forcedImportReload.current = null;
    }

    const backedOffIds = backedOffUnknownShopIds();
    const forceImport = forcedImportReload.current === reloadToken;
    const localIds = [...collection.savedShopIds]
      .sort()
      .filter(
        (localId) =>
          !heldImportIds.current.has(localId) &&
          (forceImport || !backedOffIds.has(localId)),
      )
      .slice(0, 100);

    if (localIds.length === 0) {
      if (forceImport) {
        forcedImportReload.current = null;
      }

      return;
    }

    const attempt = `${signedInUserId}:${reloadToken}:${localIds.join(",")}`;

    if (importAttempt.current === attempt) {
      return;
    }

    importAttempt.current = attempt;
    const candidates = localIds.map((localId) => {
      const prototype = prototypeShopById(localId);

      return {
        localId,
        ...(prototype ? { slug: prototype.slug } : {}),
      };
    });

    void importLocalSavedShops(candidates).then((result) => {
      if (importAttempt.current !== attempt) {
        return;
      }

      if (!result.ok) {
        setImportFailure(result.reason);

        if (
          result.reason === "authentication-required" &&
          importRefreshAttempt.current !== attempt
        ) {
          importRefreshAttempt.current = attempt;
          importAttempt.current = null;
          account.refresh();
        }

        return;
      }

      importRefreshAttempt.current = null;
      setImportFailure(null);
      const invalidIds = result.value.skipped
        .filter((entry) => entry.reason === "invalid-id")
        .map((entry) => entry.localId);
      const unknownIds = result.value.skipped
        .filter((entry) => entry.reason === "unknown-shop")
        .map((entry) => entry.localId);

      [...unknownIds, ...result.value.failed.map((entry) => entry.localId)].forEach(
        (localId) => heldImportIds.current.add(localId),
      );
      const retired = [
        ...result.value.reconciled.map((entry) => entry.localId),
        ...invalidIds,
      ];
      const newlyHeldUnknownIds = recordUnknownShopImportHolds(unknownIds);
      const importedShops = result.value.reconciled.map((entry) => entry.shop);

      releaseUnknownShopImportHolds(retired);
      collection.retireSavedShopIds(retired);
      setAccountSaves((current) => {
        const importedIds = importedShops.map((shop) => shop.id);

        return {
          ...current,
          ids: [...new Set([...current.ids, ...importedIds])],
          shops: [
            ...current.shops.filter((shop) => !importedIds.includes(shop.id)),
            ...importedShops,
          ],
        };
      });
      if (
        result.value.reconciled.length +
          invalidIds.length +
          newlyHeldUnknownIds.length +
          result.value.failed.length >
        0
      ) {
        setImportReport((current) => ({
          userId: signedInUserId,
          reconciled:
            (current?.userId === signedInUserId ? current.reconciled : 0) +
            result.value.reconciled.length,
          invalid:
            (current?.userId === signedInUserId ? current.invalid : 0) +
            invalidIds.length,
          unknown:
            (current?.userId === signedInUserId ? current.unknown : 0) +
            newlyHeldUnknownIds.length,
          failed:
            (current?.userId === signedInUserId ? current.failed : 0) +
            result.value.failed.length,
        }));
      }
      setImportBatchToken((current) => current + 1);
    });
  }, [
    account,
    accountReady,
    collection,
    importBatchToken,
    reloadToken,
    signedInUserId,
  ]);

  const savedShopIds = useMemo(
    () =>
      accountReady
        ? new Set(accountSaves.ids)
        : localMode
          ? collection.savedShopIds
          : new Set<string>(),
    [accountReady, accountSaves.ids, collection.savedShopIds, localMode],
  );

  const reportedFailure = failure ?? importFailure;

  const status: SavedShopsStatus = localMode
    ? "local"
    : reportedFailure
      ? "error"
      : accountReady
        ? "ready"
        : "loading";

  const retry = useCallback(() => {
    if (signedInUserId !== null) {
      setFailure(null);
      setImportFailure(null);
      setImportReport(null);
      heldImportIds.current.clear();
      setReloadToken((current) => {
        const next = current + 1;
        forcedImportReload.current = next;
        return next;
      });
    }
  }, [signedInUserId]);

  const toggleSaved = useCallback(
    (shopId: string, shopName?: string) => {
      if (
        account.session.status === "unavailable" &&
        account.session.reason === "not-configured"
      ) {
        collection.toggleSaved(shopId);
        return;
      }

      if (account.session.status === "signed-out") {
        // A reader may still carry a legitimate pre-account device save. They
        // can remove that local choice without being forced to create an
        // account; only a new persistent save starts the interruption.
        if (collection.isSaved(shopId)) {
          collection.toggleSaved(shopId);
          return;
        }

        requestSignIn({
          context: shopName ? `Save ${shopName}` : "Save this shop",
          intent: { type: "save-shop", shopId },
        });
        return;
      }

      if (account.session.status !== "signed-in" || !accountReady) {
        return;
      }

      if (pendingShopIds.has(shopId)) {
        return;
      }

      const shouldSave = !accountSaves.ids.includes(shopId);
      const previousShop = accountSaves.shops.find((shop) => shop.id === shopId);
      const token = (mutationTokens.current.get(shopId) ?? 0) + 1;

      mutationTokens.current.set(shopId, token);
      setFailure(null);
      setPendingShopIds((current) => new Set(current).add(shopId));
      setAccountSaves((current) => ({
        ...current,
        ids: shouldSave
          ? current.ids.includes(shopId)
            ? current.ids
            : [...current.ids, shopId]
          : current.ids.filter((id) => id !== shopId),
        shops: shouldSave
          ? current.shops
          : current.shops.filter((shop) => shop.id !== shopId),
      }));

      void setSavedShop(shopId, shouldSave).then((result) => {
        if (mutationTokens.current.get(shopId) !== token) {
          return;
        }

        setPendingShopIds((current) => {
          const next = new Set(current);
          next.delete(shopId);
          return next;
        });

        if (!result.ok) {
          setFailure(result.reason);
          setAccountSaves((current) => ({
            ...current,
            ids: shouldSave
              ? current.ids.filter((id) => id !== shopId)
              : current.ids.includes(shopId)
                ? current.ids
                : [...current.ids, shopId],
            shops:
              shouldSave || !previousShop
                ? current.shops.filter((shop) => shop.id !== shopId)
                : [...current.shops.filter((shop) => shop.id !== shopId), previousShop],
          }));

          if (result.reason === "authentication-required") {
            account.refresh();
          }

          return;
        }

        setAccountSaves((current) => ({
          ...current,
          ids: result.value.saved
            ? current.ids.includes(shopId)
              ? current.ids
              : [...current.ids, shopId]
            : current.ids.filter((id) => id !== shopId),
          shops:
            result.value.saved && result.value.shop
              ? [
                  ...current.shops.filter((shop) => shop.id !== shopId),
                  result.value.shop,
                ]
              : current.shops.filter((shop) => shop.id !== shopId),
        }));
      });
    },
    [
      account,
      accountReady,
      accountSaves.ids,
      accountSaves.shops,
      collection,
      pendingShopIds,
      requestSignIn,
    ],
  );

  const value = useMemo<SavedShopsStore>(
    () => ({
      savedShopIds,
      shops: accountReady ? accountSaves.shops : [],
      pendingShopIds,
      status,
      hydrated: status === "ready" || (status === "local" && collection.hydrated),
      failure: reportedFailure,
      isSaved: (shopId: string) => savedShopIds.has(shopId),
      toggleSaved,
      retry,
    }),
    [
      accountReady,
      accountSaves.shops,
      collection.hydrated,
      pendingShopIds,
      reportedFailure,
      retry,
      savedShopIds,
      status,
      toggleSaved,
    ],
  );

  return (
    <SavedShopsContext.Provider value={value}>
      {children}
      {signedInUserId !== null && importReport?.userId === signedInUserId ? (
        <section className={styles.notice} role="status" aria-label="Saved shop import">
          <p>
            {importReport.reconciled > 0
              ? `${importReport.reconciled} device ${importReport.reconciled === 1 ? "save is" : "saves are"} now kept with your account. `
              : ""}
            {importReport.invalid > 0
              ? `${importReport.invalid} invalid ${importReport.invalid === 1 ? "record was" : "records were"} removed from this device. `
              : ""}
            {importReport.unknown > 0
              ? `${importReport.unknown} unmatched ${importReport.unknown === 1 ? "record remains" : "records remain"} on this device for retry. `
              : ""}
            {importReport.failed > 0
              ? `${importReport.failed} ${importReport.failed === 1 ? "save remains" : "saves remain"} on this device for retry.`
              : ""}
          </p>
          <div className={styles.actions}>
            {importReport.failed + importReport.unknown > 0 ? (
              <button className={styles.retry} type="button" onClick={retry}>
                Retry
              </button>
            ) : null}
            <button
              className={styles.dismiss}
              type="button"
              onClick={() => setImportReport(null)}
              aria-label="Dismiss saved shop import result"
            >
              Dismiss
            </button>
          </div>
        </section>
      ) : null}
      {reportedFailure ? (
        <span className="visually-hidden" role="alert">
          {failureMessage(reportedFailure)}
        </span>
      ) : null}
    </SavedShopsContext.Provider>
  );
}

export function useSavedShops(): SavedShopsStore {
  const store = useContext(SavedShopsContext);

  if (!store) {
    throw new Error("useSavedShops must be used inside SavedShopsProvider");
  }

  return store;
}
