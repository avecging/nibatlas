import { mkdir } from "node:fs/promises";
import path from "node:path";

import { expect, test, type Page } from "@playwright/test";

import { ACCOUNT_PREVIEW_STORAGE_KEY } from "../../src/features/account/account-session";
import { REVIEWER_STORAGE_KEY } from "../../src/features/reviewer/reviewer-mode";
import { seedSampleCollection } from "../support/local-state";

/**
 * WP2 review evidence: the restructured Me, in every state it has.
 *
 * Not an assertion suite — `tests/e2e/me.spec.ts` holds the verdicts. This
 * writes screenshots into `docs/evidence/milestone-1-5-wp2/` so the founder can
 * read the states side by side at the three breakpoints
 * `IMPLEMENTATION-PLAN.md` names: a clean device, a device with a collection,
 * the reviewer-only signed-in preview, and the destructive confirmations open.
 *
 * Opted into with `EVIDENCE=1 pnpm test:e2e --project=evidence`.
 *
 * The 768 × 1024 and 1440 × 900 captures are evidence of the restructure only.
 * `docs/milestone-1-5-product-refinement.md` records the desktop treatment as
 * not designed and not approved; WP-D owns that, and nothing here is sign-off.
 */
const OUT_DIR = path.join(process.cwd(), "docs", "evidence", "milestone-1-5-wp2");

const BREAKPOINTS = [
  { name: "m", width: 360, height: 800 },
  { name: "t", width: 768, height: 1024 },
  { name: "d", width: 1440, height: 900 },
] as const;

async function seedDevice(
  page: Page,
  { reviewer, signedIn }: { readonly reviewer: boolean; readonly signedIn: boolean },
) {
  await page.addInitScript(
    ([reviewerKey, reviewerValue, accountKey, accountValue]) => {
      try {
        window.localStorage.setItem(reviewerKey as string, reviewerValue as string);

        if (accountValue) {
          window.localStorage.setItem(accountKey as string, accountValue as string);
        }
      } catch {
        // Nothing to do: the default is the signed-out product.
      }
    },
    [
      REVIEWER_STORAGE_KEY,
      reviewer ? "1" : "0",
      ACCOUNT_PREVIEW_STORAGE_KEY,
      signedIn
        ? JSON.stringify({ signedIn: true, displayName: "Ada Lovelace" })
        : "",
    ],
  );
}

test.beforeAll(async () => {
  await mkdir(OUT_DIR, { recursive: true });
});

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
});

async function capture(page: Page, name: string) {
  await page.screenshot({
    path: path.join(OUT_DIR, `${name}.png`),
    fullPage: true,
    animations: "disabled",
  });
}

for (const breakpoint of BREAKPOINTS) {
  /** A tester who has just been handed the link: nothing collected, no account. */
  test(`${breakpoint.name} signed-out clean`, async ({ page }) => {
    await seedDevice(page, { reviewer: false, signedIn: false });
    await page.setViewportSize(breakpoint);
    await page.goto("/me");

    await expect(page.getByText("Sign in")).toBeVisible();
    await capture(page, `${breakpoint.name}-signed-out-clean`);
  });

  /** The same reader once Places visited has something to point at. */
  test(`${breakpoint.name} signed-out with a collection`, async ({ page }) => {
    await seedDevice(page, { reviewer: false, signedIn: false });
    await seedSampleCollection(page);
    await page.setViewportSize(breakpoint);
    await page.goto("/me");

    await expect(page.getByRole("region", { name: /places visited/i })).toBeVisible();
    await capture(page, `${breakpoint.name}-signed-out-collection`);
  });

  /** The confirmation a destructive control asks for before it acts. */
  test(`${breakpoint.name} clear-data confirmation`, async ({ page }) => {
    await seedDevice(page, { reviewer: false, signedIn: false });
    await seedSampleCollection(page);
    await page.setViewportSize(breakpoint);
    await page.goto("/me");

    await page.getByRole("button", { name: /clear data on this device/i }).click();
    await expect(page.getByText(/cannot be undone/i)).toBeVisible();
    await capture(page, `${breakpoint.name}-clear-confirm`);
  });

  /**
   * The signed-in structure, reachable only as a labelled reviewer preview
   * until Milestone 4 builds authentication.
   */
  test(`${breakpoint.name} signed-in preview`, async ({ page }) => {
    await seedDevice(page, { reviewer: true, signedIn: true });
    await seedSampleCollection(page, "reviewer");
    await page.setViewportSize(breakpoint);
    await page.goto("/me");

    await expect(page.getByLabel(/display name/i)).toBeVisible();
    await capture(page, `${breakpoint.name}-signed-in`);
  });

  test(`${breakpoint.name} delete-account confirmation`, async ({ page }) => {
    await seedDevice(page, { reviewer: true, signedIn: true });
    await seedSampleCollection(page, "reviewer");
    await page.setViewportSize(breakpoint);
    await page.goto("/me");

    await page.getByRole("button", { name: /delete account/i }).click();
    await expect(page.getByText(/delete your nib atlas account\?/i)).toBeVisible();
    await capture(page, `${breakpoint.name}-delete-confirm`);
  });

  /** Where Places visited leads: the country and locality routes it links. */
  test(`${breakpoint.name} passport country from Me`, async ({ page }) => {
    await seedDevice(page, { reviewer: false, signedIn: false });
    await seedSampleCollection(page);
    await page.setViewportSize(breakpoint);
    await page.goto("/me");

    await page
      .getByRole("region", { name: /places visited/i })
      .getByRole("link", { name: /japan/i })
      .click();
    await expect(page).toHaveURL(/\/passport\/jp$/);

    await page.screenshot({
      path: path.join(OUT_DIR, `${breakpoint.name}-passport-country.png`),
      animations: "disabled",
    });
  });
}
