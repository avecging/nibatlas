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

import { decodeShopMedia, mediaPath, type ShopMedia } from "@/src/features/admin/media-contract";
import { UUID } from "@/src/features/admin/shop-contract";
import { splitShopMedia } from "@/src/features/shops/shop-media";

/**
 * One read of a shop's published media, shared by the whole page.
 *
 * The identity header needs the business's logo and the gallery needs the
 * photographs, and they are two parts of one list. Fetching it in each place
 * would cost two requests per shop and let the two disagree, so the list is read
 * once here and split once in `shop-media.ts`.
 *
 * `unavailable` is not a failure: it is a build or a record with no public media
 * route to ask — a fixture catalogue, or a shop whose id is not the UUID the
 * media route takes. Consumers render nothing at all for it, with no empty
 * gallery and no reserved logo square.
 */
export type ShopMediaStatus = "unavailable" | "loading" | "ready" | "failed";

interface ShopMediaValue {
  readonly status: ShopMediaStatus;
  readonly logo: ShopMedia | null;
  readonly photos: readonly ShopMedia[];
  /** Same-origin, publication-checked delivery. Never a raw storage URL. */
  readonly srcFor: (mediaId: string) => string;
  readonly retry: () => void;
}

const UNAVAILABLE: ShopMediaValue = {
  status: "unavailable",
  logo: null,
  photos: [],
  srcFor: () => "",
  retry: () => {},
};

const ShopMediaContext = createContext<ShopMediaValue>(UNAVAILABLE);

export function useShopMedia(): ShopMediaValue {
  return useContext(ShopMediaContext);
}

/**
 * Whether this build talks to a catalogue that can serve media at all.
 *
 * `process.env.NEXT_PUBLIC_CATALOGUE_MODE` is read as the literal expression so
 * the bundler can inline it, the same way the rest of the app reads it.
 */
function mediaRouteAvailable(shopId: string): boolean {
  return (
    UUID.test(shopId) &&
    (process.env.NEXT_PUBLIC_CATALOGUE_MODE === "api" ||
      process.env.NEXT_PUBLIC_CATALOGUE_MODE === "api-demo")
  );
}

export function ShopMediaProvider({
  shopId,
  children,
}: {
  readonly shopId: string;
  readonly children: ReactNode;
}) {
  const available = mediaRouteAvailable(shopId);
  const [attempt, setAttempt] = useState(0);
  /*
   * The read carries the request it answered.
   *
   * Keeping the key with the result, rather than clearing state when the shop
   * changes, is what makes a navigation safe: a list is only ever shown for the
   * request it belongs to, so the previous shop's photographs cannot survive on
   * screen while the next shop's list is still in flight, and a late response
   * for an abandoned request has nowhere to land.
   */
  const [read, setRead] = useState<{
    readonly key: string;
    readonly entries: readonly ShopMedia[] | "failed";
  } | null>(null);
  const key = `${shopId}:${attempt}`;

  useEffect(() => {
    if (!available) {
      return;
    }

    const controller = new AbortController();

    fetch(mediaPath(shopId, false), { signal: controller.signal, cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("media list unavailable");
        }

        const entries = decodeShopMedia((await response.json()).entries);

        if (!controller.signal.aborted) {
          setRead({ key, entries });
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setRead({ key, entries: "failed" });
        }
      });

    return () => controller.abort();
  }, [available, key, shopId]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  const value = useMemo<ShopMediaValue>(() => {
    if (!available) {
      return UNAVAILABLE;
    }

    const current = read?.key === key ? read : null;
    const entries = current && current.entries !== "failed" ? current.entries : [];
    const { logo, photos } = splitShopMedia(entries);

    return {
      status:
        current === null ? "loading" : current.entries === "failed" ? "failed" : "ready",
      logo,
      photos,
      srcFor: (mediaId: string) => `${mediaPath(shopId, false)}/${mediaId}`,
      retry,
    };
  }, [available, key, read, retry, shopId]);

  return <ShopMediaContext.Provider value={value}>{children}</ShopMediaContext.Provider>;
}
