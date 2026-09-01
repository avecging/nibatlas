import { mkdir } from "node:fs/promises";
import path from "node:path";

import { expect, test, type Page, type Route } from "@playwright/test";

import { useNormalMode } from "../support/local-state";

/**
 * WP7 review evidence: the contribution and help routes.
 *
 * Not an assertion suite — `tests/e2e/contribute.spec.ts` holds the verdicts.
 * This writes screenshots into `docs/evidence/milestone-1-5-wp7/` so the founder
 * can read the two forms, the failure that offers the email route, the
 * confirmation, and the help page at the three breakpoints
 * `IMPLEMENTATION-PLAN.md` names.
 *
 * Opted into with `EVIDENCE=1 pnpm test:e2e --project=evidence`.
 *
 * The intake is a Google Apps Script behind a Worker secret, so the two states
 * that depend on it are captured against a stubbed route rather than a live
 * one. The stub decides only whether the request succeeded; every pixel above it
 * is the real page.
 *
 * The 768 × 1024 and 1440 × 900 captures show responsive integrity only. WP-D
 * owns the desktop treatment and nothing here is sign-off.
 */
const OUT_DIR = path.join(process.cwd(), "docs", "evidence", "milestone-1-5-wp7");

const BREAKPOINTS = [
  { name: "m", width: 360, height: 800 },
  { name: "t", width: 768, height: 1024 },
  { name: "d", width: 1440, height: 900 },
] as const;

test.beforeAll(async () => {
  await mkdir(OUT_DIR, { recursive: true });
});

async function capture(page: Page, name: string) {
  await page.screenshot({
    path: path.join(OUT_DIR, `${name}.png`),
    animations: "disabled",
    fullPage: true,
  });
}

async function fillSuggestion(page: Page) {
  await page.getByLabel(/^shop name/i).fill("Pen and Paper");
  await page.getByLabel(/^city/i).fill("Seoul");
  await page.getByLabel(/^country/i).fill("South Korea");
  await page
    .getByLabel(/what makes it worth a visit/i)
    .fill("A long nib counter, and someone who will let you try before you buy.");
}

for (const breakpoint of BREAKPOINTS) {
  test.describe(`${breakpoint.width} × ${breakpoint.height}`, () => {
    test.use({ viewport: { width: breakpoint.width, height: breakpoint.height } });

    test.beforeEach(async ({ page }) => {
      await useNormalMode(page);
    });

    test("suggest a shop", async ({ page }) => {
      await page.goto("/suggest-shop");
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await capture(page, `${breakpoint.name}-suggest-shop`);
    });

    /** The correction, named for the listing it came from and never asking. */
    test("report a listing", async ({ page }) => {
      await page.goto("/shops/ty-lee-pen-shop/report");
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await capture(page, `${breakpoint.name}-report-listing`);
    });

    test("a submission that could not be sent", async ({ page }) => {
      await page.route("**/api/contribute", (route: Route) =>
        route.fulfill({ status: 503, json: { ok: false, error: "unavailable" } }),
      );

      await page.goto("/suggest-shop");
      await fillSuggestion(page);
      await page.getByRole("button", { name: /send this suggestion/i }).click();
      await expect(page.getByTestId("contribute-problem")).toBeVisible();
      await capture(page, `${breakpoint.name}-submission-failed`);
    });

    test("the confirmation", async ({ page }) => {
      await page.route("**/api/contribute", (route: Route) =>
        route.fulfill({ status: 200, json: { ok: true } }),
      );

      await page.goto("/suggest-shop");
      await fillSuggestion(page);
      await page.getByRole("button", { name: /send this suggestion/i }).click();
      await expect(page.getByRole("status")).toBeVisible();
      await capture(page, `${breakpoint.name}-submission-sent`);
    });

    test("help", async ({ page }) => {
      await page.goto("/help");
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await capture(page, `${breakpoint.name}-help`);
    });
  });
}
