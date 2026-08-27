import type { Page } from "@playwright/test";

import { ACCOUNT_PREVIEW_STORAGE_KEY } from "../../src/features/account/account-session";
import {
  COLLECTION_STORAGE_KEYS,
  LEGACY_COLLECTION_SESSION_KEY,
} from "../../src/features/collection/collection-store";
import { REVIEWER_STORAGE_KEY } from "../../src/features/reviewer/reviewer-mode";
import {
  prototypeSeedCollections,
  prototypeSeedSavedShopIds,
} from "../../src/fixtures/prototype-passport";

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
 * Arranges the reviewer-only signed-in preview.
 *
 * Reviewer mode is seeded alongside it, because that is the only audience the
 * preview resolves for. Named `seed…` rather than `use…` so the lint rule for
 * React hooks does not read it as one.
 */
export async function seedSignedInPreview(
  page: Page,
  displayName: string | null = null,
) {
  await seedStorage(page, [
    { area: "local", key: REVIEWER_STORAGE_KEY, value: "1" },
    {
      area: "local",
      key: ACCOUNT_PREVIEW_STORAGE_KEY,
      value: JSON.stringify({ signedIn: true, displayName }),
    },
  ]);
}

/** Seeds the preview key without reviewer mode, to prove it cannot be read. */
export async function seedOrphanedSignedInPreview(page: Page) {
  await seedStorage(page, [
    {
      area: "local",
      key: ACCOUNT_PREVIEW_STORAGE_KEY,
      value: JSON.stringify({ signedIn: true, displayName: "Ada" }),
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
  ACCOUNT_PREVIEW_STORAGE_KEY,
  COLLECTION_STORAGE_KEYS,
  LEGACY_COLLECTION_SESSION_KEY,
  REVIEWER_STORAGE_KEY,
};
