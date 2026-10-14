import { mkdir } from "node:fs/promises";
import path from "node:path";

import { expect, test, type Page } from "@playwright/test";

import { seedSampleCollection, useNormalMode } from "../support/local-state";

/**
 * WP6 review evidence: the filter drawer and the approved card/marker interaction.
 *
 * Not an assertion suite — `tests/e2e/explore.spec.ts` and
 * `tests/e2e/results-sheet.spec.ts` hold the verdicts. This writes screenshots
 * into `docs/evidence/milestone-1-5-wp6/` so the founder can read the four-way
 * visit segment, the drawer as a transaction, the applied count, the separated
 * card states and the marker highlight at the three breakpoints
 * `IMPLEMENTATION-PLAN.md` names.
 *
 * Opted into with `EVIDENCE=1 pnpm test:e2e --project=evidence`.
 *
 * The 768 × 1024 and 1440 × 900 captures show responsive integrity only.
 * `docs/milestone-1-5-product-refinement.md` records the desktop treatment as
 * not designed and not approved; WP-D owns that, and nothing here is sign-off.
 */
const OUT_DIR = path.join(process.cwd(), "docs", "evidence", "milestone-1-5-wp6");

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
  });
}

async function openMap(page: Page) {
  await page.goto("/");
  await expect(page.getByTestId("map-canvas")).toBeVisible();

  const dismiss = page.getByRole("button", { name: "Dismiss introduction" });

  if (await dismiss.isVisible().catch(() => false)) {
    await dismiss.click();
  }
}

async function searchGinza(page: Page) {
  await page.getByRole("combobox", { name: /search shops or places/i }).fill("Ginza");
  await page.getByRole("option", { name: /^Ginza/ }).first().click();
  await expect(page.getByTestId("explore")).toHaveAttribute(
    "data-committed-label",
    /Ginza/,
  );
  await expect(page.getByTestId("explore")).toHaveAttribute("data-search-offer", "hidden");
}

/** Below the desktop split the filters live in the sheet, which opens at Peek. */
async function raiseSheet(page: Page) {
  const handle = page.getByRole("button", { name: /results sheet/i });

  if (!(await handle.isVisible().catch(() => false))) {
    return;
  }

  await handle.click();
  await handle.click();
  await expect(page.getByTestId("results-sheet")).toHaveAttribute("data-state", "full");

  // The handle travels up as the sheet grows, leaving the pointer resting over a
  // card and highlighting it. A capture of the resting state should show the
  // resting state.
  await page.mouse.move(0, 0);
}

const drawer = (page: Page) => page.getByRole("dialog", { name: "Filters" });

for (const breakpoint of BREAKPOINTS) {
  test.describe(breakpoint.name, () => {
    test.use({ viewport: { width: breakpoint.width, height: breakpoint.height } });

    /** The resting state: the four-way visit segment and one labelled button. */
    test("the filter row at rest", async ({ page }) => {
      await useNormalMode(page);
      await openMap(page);
      await searchGinza(page);
      await raiseSheet(page);

      await expect(page.getByRole("group", { name: "Visit status" })).toBeVisible();
      await capture(page, `${breakpoint.name}-filters-rest`);
    });

    /** The drawer: shop type, availability, the honesty note, and the actions. */
    test("the filter drawer open", async ({ page }) => {
      await useNormalMode(page);
      await openMap(page);
      await searchGinza(page);
      await raiseSheet(page);

      await page.getByRole("button", { name: /^filters/i }).click();
      await expect(drawer(page)).toBeVisible();

      await capture(page, `${breakpoint.name}-filters-drawer`);
    });

    /** A draft held, counted, and not yet committed to the results behind it. */
    test("a drafted filter awaiting Apply", async ({ page }) => {
      await useNormalMode(page);
      await openMap(page);
      await searchGinza(page);
      await raiseSheet(page);

      await page.getByRole("button", { name: /^filters/i }).click();
      await drawer(page)
        .getByRole("button", { name: "Stationery Store", exact: true })
        .click();
      await drawer(page)
        .getByRole("button", { name: "Recorded as open", exact: true })
        .click();
      await expect(drawer(page).getByText(/shops? match/)).toBeVisible();

      await capture(page, `${breakpoint.name}-filters-draft`);
    });

    /** After Apply: the count badge on the button, and the one-tap clear. */
    test("filters applied, counted, and clearable", async ({ page }) => {
      await useNormalMode(page);
      await openMap(page);
      await searchGinza(page);
      await raiseSheet(page);

      await page.getByRole("button", { name: /^filters/i }).click();
      await drawer(page)
        .getByRole("button", { name: "Recorded as open", exact: true })
        .click();
      await drawer(page).getByRole("button", { name: "Apply filters" }).click();

      await expect(page.getByTestId("filter-count")).toBeVisible();
      await expect(page.getByRole("button", { name: /clear filters/i })).toBeVisible();

      await capture(page, `${breakpoint.name}-filters-active`);
    });

    /**
     * The separated card states: an operational status about the shop, plus
     * visited and saved as the reader's own two independent facts — rather than
     * one three-position pill standing for all of them.
     */
    test("card states as separate facts", async ({ page }) => {
      await useNormalMode(page);
      await seedSampleCollection(page);
      await openMap(page);
      await searchGinza(page);
      await raiseSheet(page);

      const card = page.getByRole("article", { name: "Ginza Itoya Main Store" });
      await expect(card).toBeVisible();
      await card.getByRole("button", { name: /^save$/i }).click();

      await capture(page, `${breakpoint.name}-card-states`);
    });

    /** Hover and keyboard focus both synchronise the marker. */
    test("a focused card highlights its marker", async ({ page }) => {
      await useNormalMode(page);
      await openMap(page);
      await searchGinza(page);
      await raiseSheet(page);

      const card = page.getByRole("article", { name: "Ginza Itoya Main Store" });
      await card.getByRole("link", { name: "Ginza Itoya Main Store" }).focus();

      await expect(
        page.getByRole("button", { name: /^Ginza Itoya Main Store, Chūō, Tokyo\./ }).first(),
      ).toHaveAttribute("data-highlighted", "true");

      await capture(page, `${breakpoint.name}-card-highlight`);
    });
  });
}
