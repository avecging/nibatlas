import type { Page } from "@playwright/test";

import {
  COLLECTION_STORAGE_KEYS,
  LEGACY_COLLECTION_SESSION_KEY,
} from "../../src/features/collection/collection-store";
import {
  PASSPORT_VIEW_STORAGE_KEYS,
  serializePassportView,
  type PassportViewRecord,
} from "../../src/features/passport/passport-view-state";
import { REVIEWER_STORAGE_KEY } from "../../src/features/reviewer/reviewer-mode";
import { prototypeShopDetails } from "../../src/fixtures/prototype-catalogue";
import {
  prototypeSeedCollections,
  prototypeSeedSavedShopIds,
  toStampCollection,
} from "../../src/fixtures/prototype-passport";
import { STAMPS_PER_PAGE } from "../../src/features/passport/passport-pages";

/**
 * Arranging local device state for a journey test.
 *
 * A clean normal-mode device now starts with no saves and no impressions, which
 * is the point — sample history must never look like the tester's own. Journeys
 * that need a populated Passport therefore have to *arrange* it, in the same
 * place a real person's state lives, rather than relying on a seeded default.
 *
 * Everything here runs as an init script, so the state is in place before the
 * application's first render and no test has to toggle anything after paint.
 */
const SAMPLE_STATE = JSON.stringify({
  savedShopIds: prototypeSeedSavedShopIds,
  collections: prototypeSeedCollections,
});

async function seedStorage(
  page: Page,
  entries: readonly { readonly area: "local" | "session"; readonly key: string; readonly value: string }[],
) {
  await page.addInitScript((items) => {
    for (const item of items as typeof entries) {
      try {
        const store = item.area === "local" ? window.localStorage : window.sessionStorage;
        store.setItem(item.key, item.value);
      } catch {
        // A browser with storage blocked still runs the journey, just without
        // the arranged state.
      }
    }
  }, entries);
}

/**
 * A locality that spans more than one page.
 *
 * The catalogue has no locality with more than two shops in it, and the defect
 * this arranges for only exists past `STAMPS_PER_PAGE`: a locality with five or
 * six impressions has a continuation page, and country plus locality alone
 * cannot tell it from the first one. Six real catalogue shops are gathered into
 * one locality — test data, and only ever written into a test browser's own
 * storage.
 *
 * Dates descend from the first entry, so the newest-first order is fixed and the
 * page split is the same every run: four impressions on the locality's first
 * page, two on its second.
 */
export const PAGED_LOCALITY = {
  countryCode: "JP",
  countryLabel: "Japan",
  name: "Chūō, Tokyo",
  slug: "chuo-tokyo",
} as const;

export const pagedLocalityCollections = prototypeShopDetails
  .slice(0, STAMPS_PER_PAGE + 2)
  .map((shop, index) => {
    const base = toStampCollection(shop, `2026-05-0${6 - index}`);

    return {
      ...base,
      countryCode: PAGED_LOCALITY.countryCode,
      countryLabel: PAGED_LOCALITY.countryLabel,
      localityName: PAGED_LOCALITY.name,
      localitySlug: PAGED_LOCALITY.slug,
      stamp: {
        ...base.stamp,
        localityLabel: PAGED_LOCALITY.name,
        countryLabel: PAGED_LOCALITY.countryLabel,
      },
    };
  });

/** The impressions that land on the locality's second page, newest first. */
export const pagedLocalityContinuation = pagedLocalityCollections.slice(
  STAMPS_PER_PAGE,
);

export async function seedPagedLocality(
  page: Page,
  scope: "normal" | "reviewer" = "normal",
) {
  await seedStorage(page, [
    {
      area: "local",
      key: COLLECTION_STORAGE_KEYS[scope],
      value: JSON.stringify({
        savedShopIds: [],
        collections: pagedLocalityCollections,
      }),
    },
  ]);
}

/** Puts the device into reviewer mode without a URL parameter. */
export async function useReviewerMode(page: Page) {
  await seedStorage(page, [
    { area: "local", key: REVIEWER_STORAGE_KEY, value: "1" },
  ]);
}

/** States the default explicitly, for tests about the clean-device case. */
export async function useNormalMode(page: Page) {
  await seedStorage(page, [
    { area: "local", key: REVIEWER_STORAGE_KEY, value: "0" },
  ]);
}

/**
 * Gives the device a collection to browse.
 *
 * Defaults to the normal store, because "a tester who has saved and collected
 * things" is ordinary local state — the defect was creating it *silently*, not
 * its existence.
 */
export async function seedSampleCollection(
  page: Page,
  scope: "normal" | "reviewer" = "normal",
) {
  await seedStorage(page, [
    { area: "local", key: COLLECTION_STORAGE_KEYS[scope], value: SAMPLE_STATE },
  ]);
}

/**
 * Arranges the Passport's remembered view state.
 *
 * Only what a test names is set; everything else stays at "never chosen", which
 * is what a clean device holds. Pass a raw string to arrange a corrupt or
 * hand-edited record.
 */
export async function seedPassportView(
  page: Page,
  record: Partial<PassportViewRecord> | string,
  scope: "normal" | "reviewer" = "normal",
) {
  const value =
    typeof record === "string"
      ? record
      : serializePassportView({
          mode: null,
          coverSeen: false,
          place: null,
          listScrollTop: 0,
          ...record,
        });

  /*
   * Written only when the key is absent.
   *
   * An init script runs on *every* navigation, so an unconditional write would
   * undo what the application itself had just recorded — a journey that opens
   * the cover, goes to Me and comes back would find `coverSeen` reset to false
   * and be shown the cover twice. Seeding the starting state and then leaving
   * the application's own writes alone is what makes those journeys testable.
   */
  await page.addInitScript(
    ([key, initial]) => {
      try {
        if (window.localStorage.getItem(key as string) === null) {
          window.localStorage.setItem(key as string, initial as string);
        }
      } catch {
        // A browser with storage blocked still runs the journey, just without
        // the arranged state.
      }
    },
    [PASSPORT_VIEW_STORAGE_KEYS[scope], value],
  );
}

/** Writes an empty store, so a reviewer device does not fall back to the seed. */
export async function seedEmptyCollection(
  page: Page,
  scope: "normal" | "reviewer" = "reviewer",
) {
  await seedStorage(page, [
    {
      area: "local",
      key: COLLECTION_STORAGE_KEYS[scope],
      value: JSON.stringify({ savedShopIds: [], collections: [] }),
    },
  ]);
}

/** Recreates a Milestone 1 staging session, to prove it cannot leak forward. */
export async function seedLegacyPrototypeSession(page: Page) {
  await seedStorage(page, [
    { area: "session", key: LEGACY_COLLECTION_SESSION_KEY, value: SAMPLE_STATE },
  ]);
}

export {
  COLLECTION_STORAGE_KEYS,
  LEGACY_COLLECTION_SESSION_KEY,
  PASSPORT_VIEW_STORAGE_KEYS,
  REVIEWER_STORAGE_KEY,
};
