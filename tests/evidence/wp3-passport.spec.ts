import { mkdir } from "node:fs/promises";
import path from "node:path";

import { expect, test, type Page } from "@playwright/test";

import {
  seedPassportView,
  seedSampleCollection,
  seedSignedInPreview,
  useNormalMode,
} from "../support/local-state";

/**
 * WP3 review evidence: the Passport's two modes, its cover, and the enlarged
 * stamp.
 *
 * Not an assertion suite — `tests/e2e/passport.spec.ts` holds the verdicts. This
 * writes screenshots into `docs/evidence/milestone-1-5-wp3/` so the founder can
 * read the states side by side at the three breakpoints
 * `IMPLEMENTATION-PLAN.md` names.
 *
 * Opted into with `EVIDENCE=1 pnpm test:e2e --project=evidence`.
 *
 * The 768 × 1024 and 1440 × 900 captures show responsive integrity only.
 * `docs/milestone-1-5-product-refinement.md` records the desktop treatment as
 * not designed and not approved; WP-D owns that, and nothing here is sign-off.
 */
const OUT_DIR = path.join(process.cwd(), "docs", "evidence", "milestone-1-5-wp3");

const BREAKPOINTS = [
  { name: "m", width: 360, height: 800 },
  { name: "t", width: 768, height: 1024 },
  { name: "d", width: 1440, height: 900 },
] as const;

test.beforeAll(async () => {
  await mkdir(OUT_DIR, { recursive: true });
});

async function capture(page: Page, name: string, fullPage = false) {
  await page.screenshot({
    path: path.join(OUT_DIR, `${name}.png`),
    fullPage,
    animations: "disabled",
  });
}

/** Waits for the device's own state to resolve before capturing anything. */
async function settled(page: Page) {
  await expect(page.getByRole("group", { name: "Passport view" })).toBeVisible();
}

async function bookSettled(page: Page) {
  await expect
    .poll(
      async () =>
        page.evaluate(
          () =>
            document
              .querySelector('[class*="book"][data-opened]')
              ?.getAttribute("data-opened") === "true",
        ),
      { timeout: 5000 },
    )
    .toBe(true);
}

for (const breakpoint of BREAKPOINTS) {
  test.describe(breakpoint.name, () => {
    test.use({ viewport: { width: breakpoint.width, height: breakpoint.height } });

    /** A tester who has just been handed the link, in the mode they default to. */
    test("empty normal List", async ({ page }) => {
      await useNormalMode(page);
      await page.goto("/passport");
      await settled(page);

      await expect(
        page.getByRole("heading", { name: /no stamps collected yet/i }),
      ).toBeVisible();
      await capture(page, `${breakpoint.name}-list-empty`, true);
    });

    /** The same reader with a collection: stats, then country and locality. */
    test("populated List", async ({ page }) => {
      await useNormalMode(page);
      await seedSampleCollection(page);
      await page.goto("/passport");
      await settled(page);

      await expect(page.getByText("Countries visited")).toBeVisible();
      await capture(page, `${breakpoint.name}-list`, true);
    });

    /** A country route, narrowed to the country the reader asked for. */
    test("List narrowed to a locality", async ({ page }) => {
      await useNormalMode(page);
      await seedSampleCollection(page);
      await page.goto("/passport/jp/chuo-tokyo");
      await settled(page);

      await expect(
        page.getByRole("heading", { level: 1, name: "Chūō, Tokyo" }),
      ).toBeVisible();
      await capture(page, `${breakpoint.name}-list-locality`, true);
    });

    /** The redesigned cover: issuing line, mark, PASSPORT, VOLUME I. */
    test("first-run Book cover", async ({ page }) => {
      await useNormalMode(page);
      await seedSampleCollection(page);
      await seedPassportView(page, { mode: "book" });
      await page.goto("/passport");
      await settled(page);

      await expect(page.getByRole("button", { name: /open passport/i })).toBeVisible();
      await capture(page, `${breakpoint.name}-book-cover`);
    });

    /** The opening spread: country seals, facing the most recent locality. */
    test("opening content spread", async ({ page }) => {
      await useNormalMode(page);
      await seedSampleCollection(page);
      await seedPassportView(page, { mode: "book", coverSeen: true });
      await page.goto("/passport");
      await bookSettled(page);

      await capture(page, `${breakpoint.name}-book-opening`);
    });

    /** The contents index, and the identity page facing it on a spread. */
    test("country and locality index", async ({ page }) => {
      await useNormalMode(page);
      await seedSampleCollection(page);
      await seedPassportView(page, { mode: "book", coverSeen: true });
      await page.goto("/passport");
      await bookSettled(page);

      await page.getByRole("button", { name: /^contents$/i }).click();
      await expect(page.getByRole("heading", { name: "Contents" })).toBeVisible();
      await capture(page, `${breakpoint.name}-book-index`);
    });

    /** A locality spread reached by its own URL. */
    test("locality spread", async ({ page }) => {
      await useNormalMode(page);
      await seedSampleCollection(page);
      await seedPassportView(page, { mode: "book", coverSeen: true });
      await page.goto("/passport/jp/chuo-tokyo");
      await bookSettled(page);

      await capture(page, `${breakpoint.name}-book-locality`);
    });

    /** The impression at a size worth looking at. */
    test("enlarged stamp detail", async ({ page }) => {
      await useNormalMode(page);
      await seedSampleCollection(page);
      await page.goto("/passport");
      await settled(page);

      await page.getByRole("button").filter({ hasText: /2026-03-14/ }).first().click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await capture(page, `${breakpoint.name}-stamp-detail`);
    });

    /** The identity page with a display name from the account seam. */
    test("identity with a display name", async ({ page }) => {
      await seedSignedInPreview(page, "Ada Lovelace");
      await seedPassportView(page, { mode: "book", coverSeen: true }, "reviewer");
      await page.goto("/passport");
      await bookSettled(page);

      await page.getByRole("button", { name: /^contents$/i }).click();

      if (await page.getByText("Passport of impressions").isHidden().catch(() => true)) {
        await page.getByRole("button", { name: /previous page/i }).click();
      }

      await expect(page.getByRole("heading", { name: "Ada Lovelace" })).toBeVisible();
      await capture(page, `${breakpoint.name}-identity-named`);
    });

    /** And the fallback, which is never derived from an address. */
    test("identity fallback", async ({ page }) => {
      await useNormalMode(page);
      await seedSampleCollection(page);
      await seedPassportView(page, { mode: "book", coverSeen: true });
      await page.goto("/passport");
      await bookSettled(page);

      await page.getByRole("button", { name: /^contents$/i }).click();

      if (await page.getByText("Passport of impressions").isHidden().catch(() => true)) {
        await page.getByRole("button", { name: /previous page/i }).click();
      }

      await expect(page.getByRole("heading", { name: "Your Passport" })).toBeVisible();
      await capture(page, `${breakpoint.name}-identity-fallback`);
    });

    /**
     * Reduced motion, where the treatment differs visibly: the object loses its
     * three-quarter tilt and its perspective, and keeps every page and control.
     */
    test.describe("reduced motion", () => {
      test("Book opening spread", async ({ page }) => {
        await page.emulateMedia({ reducedMotion: "reduce" });
        await useNormalMode(page);
        await seedSampleCollection(page);
        await seedPassportView(page, { mode: "book", coverSeen: true });
        await page.goto("/passport");
        await bookSettled(page);

        await capture(page, `${breakpoint.name}-book-reduced-motion`);
      });

      test("Book cover", async ({ page }) => {
        await page.emulateMedia({ reducedMotion: "reduce" });
        await useNormalMode(page);
        await seedSampleCollection(page);
        await seedPassportView(page, { mode: "book" });
        await page.goto("/passport");
        await settled(page);

        await expect(page.getByRole("button", { name: /open passport/i })).toBeVisible();
        await capture(page, `${breakpoint.name}-book-cover-reduced-motion`);
      });
    });
  });
}
