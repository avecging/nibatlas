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
import { useAccountSession } from "@/src/features/account/AccountSessionProvider";
import { useSignInPrompt } from "@/src/features/auth/SignInProvider";
import { useCollection } from "@/src/features/collection/collection-store";
import {
  fetchSavedShops,
  setSavedShop,
  type SavedShopClientFailure,
} from "@/src/features/saved/saved-shops-client";

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
  const readToken = useRef(0);
  const mutationTokens = useRef(new Map<string, number>());

  const signedInUserId =
    account.session.status === "signed-in" ? account.session.userId : null;
  const accountReady =
    signedInUserId !== null && accountSaves.userId === signedInUserId;

  useEffect(() => {
    if (signedInUserId === null) {
      return;
    }

    const token = readToken.current + 1;
    readToken.current = token;
    const controller = new AbortController();

    setFailure(null);

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

      setAccountSaves({
        userId: signedInUserId,
        ids: result.value.savedShopIds,
        shops: result.value.shops,
      });
    });

    return () => controller.abort();
  }, [account, reloadToken, signedInUserId]);

  const savedShopIds = useMemo(
    () =>
      accountReady
        ? new Set(accountSaves.ids)
        : signedInUserId === null
          ? collection.savedShopIds
          : new Set<string>(),
    [accountReady, accountSaves.ids, collection.savedShopIds, signedInUserId],
  );

  const status: SavedShopsStatus =
    signedInUserId === null
      ? "local"
      : failure
        ? "error"
        : accountReady
          ? "ready"
          : "loading";

  const retry = useCallback(() => {
    if (signedInUserId !== null) {
      setFailure(null);
      setReloadToken((current) => current + 1);
    }
  }, [signedInUserId]);

  const toggleSaved = useCallback(
    (shopId: string, shopName?: string) => {
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
      failure,
      isSaved: (shopId: string) => savedShopIds.has(shopId),
      toggleSaved,
      retry,
    }),
    [
      accountReady,
      accountSaves.shops,
      collection.hydrated,
      failure,
      pendingShopIds,
      retry,
      savedShopIds,
      status,
      toggleSaved,
    ],
  );

  return (
    <SavedShopsContext.Provider value={value}>
      {children}
      {failure ? (
        <span className="visually-hidden" role="alert">
          {failureMessage(failure)}
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
