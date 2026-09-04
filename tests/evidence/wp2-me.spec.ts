import { mkdir } from "node:fs/promises";
import path from "node:path";

import { expect, test, type Page } from "@playwright/test";

import { REVIEWER_STORAGE_KEY } from "../../src/features/reviewer/reviewer-mode";
import { stubSession } from "../support/auth";
import { seedSampleCollection } from "../support/local-state";

/**
 * WP2 review evidence: the restructured Me, in every state it has.
 *
 * Not an assertion suite — `tests/e2e/me.spec.ts` holds the verdicts. This
 * writes screenshots into `docs/evidence/milestone-1-5-wp2/` so the founder can
 * read the states side by side at the three breakpoints
 * `IMPLEMENTATION-PLAN.md` names: a clean device, a device with a collection,
 * the signed-in structure, and the clear-data confirmation open.
 *
 * Milestone 4 WP3 replaced the reviewer preview this file was written against
 * with a real session, so the signed-in captures are now arranged by answering
 * the application's own session route. The delete-account capture is gone with
 * the confirmation it recorded: deletion has no route to call, so the row states
 * that instead of asking a question it cannot honour. The current interruption
 * and account evidence lives in `m4-wp3-auth-interruption.spec.ts`.
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
    ([reviewerKey, reviewerValue]) => {
      try {
        window.localStorage.setItem(reviewerKey as string, reviewerValue as string);
      } catch {
        // Nothing to do: the default is the signed-out product.
      }
    },
    [REVIEWER_STORAGE_KEY, reviewer ? "1" : "0"],
  );

  await stubSession(
    page,
    signedIn ? { kind: "signed-in", displayName: "Ada Lovelace" } : { kind: "signed-out" },
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

  /** The signed-in structure, against a real session. */
  test(`${breakpoint.name} signed-in`, async ({ page }) => {
    await seedDevice(page, { reviewer: false, signedIn: true });
    await seedSampleCollection(page);
    await page.setViewportSize(breakpoint);
    await page.goto("/me");

    await expect(
      page.getByRole("region", { name: /^account$/i }).getByText("Ada Lovelace"),
    ).toBeVisible();
    await capture(page, `${breakpoint.name}-signed-in`);
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
