import { mkdir } from "node:fs/promises";
import path from "node:path";

import { expect, test, type Page } from "@playwright/test";

import {
  seedPassportView,
  seedSampleCollection,
  useNormalMode,
} from "../support/local-state";

/**
 * WP5 review evidence: the impression family, the seals, the overlays, the
 * application frame, and the Passport's own navigation.
 *
 * Not an assertion suite — `tests/e2e/app-frame.spec.ts`,
 * `tests/e2e/passport.spec.ts`, `tests/e2e/accessibility.spec.ts` and the
 * component tests hold the verdicts. This writes screenshots into
 * `docs/evidence/milestone-1-5-wp5/` so the founder can read the states side by
 * side.
 *
 * Opted into with `EVIDENCE=1 pnpm test:e2e --project=evidence`.
 *
 * The 768 × 1024 and 1440 × 900 captures show responsive integrity only.
 * `docs/milestone-1-5-product-refinement.md` records the desktop treatment as
 * not designed and not approved; WP-D owns that, and nothing here is sign-off.
 */
const OUT_DIR = path.join(process.cwd(), "docs", "evidence", "milestone-1-5-wp5");

const BREAKPOINTS = [
  { name: "m", width: 360, height: 800 },
  { name: "t", width: 768, height: 1024 },
  { name: "d", width: 1440, height: 900 },
] as const;

/** The reduced-height mobile screen the frame defect actually showed up on. */
const SHORT = { name: "s", width: 360, height: 568 } as const;

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

/**
 * One element, not the viewport.
 *
 * A seal at rest sits high in the List, so a viewport capture of "the country
 * seal" came out byte-identical to the capture of the Passport at rest — which
 * is exactly the defect WP3's own review found in its evidence. Cropping to the
 * block the artefact lives in makes each capture show the thing it is named
 * after.
 */
async function captureElement(page: Page, selector: string, name: string) {
  await page
    .locator(selector)
    .first()
    .screenshot({ path: path.join(OUT_DIR, `${name}.png`), animations: "disabled" });
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

    test.beforeEach(async ({ page }) => {
      await useNormalMode(page);
      await seedSampleCollection(page);
      await page.emulateMedia({ reducedMotion: "reduce" });
    });

    /** Shop impressions as List rows: the compact composition on its own sheet. */
    test("list", async ({ page }) => {
      await page.goto("/passport");
      await settled(page);
      await capture(page, `${breakpoint.name}-impression-list`, true);
    });

    /** The same impressions pressed onto a book page, where the leaf is the paper. */
    test("book", async ({ page }) => {
      await seedPassportView(page, { mode: "book", coverSeen: true });
      await page.goto("/passport");
      await settled(page);
      await bookSettled(page);
      await capture(page, `${breakpoint.name}-impression-book`);
    });

    /** The enlarged shop impression: the sheet the ceremony also uses. */
    test("impression detail", async ({ page }) => {
      await page.goto("/passport");
      await settled(page);
      await page
        .getByRole("button", { name: /Ginza Itoya Main Store/ })
        .first()
        .click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await capture(page, `${breakpoint.name}-impression-detail`);
    });

    /** The country seal at the head of its section, then enlarged. */
    test("country seal", async ({ page }) => {
      await page.goto("/passport");
      await settled(page);

      const seal = page.getByRole("button", { name: /country seal/i }).first();

      await seal.scrollIntoViewIfNeeded();
      await captureElement(
        page,
        '[class*="countryHead"]:has([data-seal-scope="country"])',
        `${breakpoint.name}-seal-country`,
      );

      await seal.click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await capture(page, `${breakpoint.name}-seal-country-detail`);
    });

    /** The locality seal beside its subheading, then enlarged. */
    test("locality seal", async ({ page }) => {
      await page.goto("/passport");
      await settled(page);

      const seal = page.getByRole("button", { name: /locality seal/i }).first();

      await seal.scrollIntoViewIfNeeded();
      await captureElement(
        page,
        '[class*="localityHead"]:has([data-seal-scope="locality"])',
        `${breakpoint.name}-seal-locality`,
      );

      await seal.click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await capture(page, `${breakpoint.name}-seal-locality-detail`);
    });

    /**
     * The collected impression a shop page shows, and the identity plate above
     * it. This is the artefact the enlarged Passport impression has to belong to
     * the same family as.
     */
    test("shop collected impression", async ({ page }) => {
      await page.goto("/shops/ginza-itoya-main-store");
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await captureElement(
        page,
        '[class*="ShopDetailView"][class*="hero"]',
        `${breakpoint.name}-shop-identity-plate`,
      );

      await page.getByRole("button", { name: /view atlas stamp/i }).click();
      await page.getByRole("button", { name: /show the impression/i }).click();
      await expect(
        page.getByRole("dialog", { name: /already in your passport/i }),
      ).toBeVisible();
      await capture(page, `${breakpoint.name}-shop-collected-impression`);
    });

    /**
     * Long names, in three scripts.
     *
     * `NAGASAWA Stationery Center Main Store` is the longest Latin name in the
     * catalogue and `銀座 伊東屋 横浜元町` the longest Japanese one; the locality
     * `East District, Tainan` is the longest place name. All three wrap inside
     * the impression rather than being shrunk onto one line.
     */
    test("long names", async ({ page }) => {
      await page.goto("/passport/jp/chuo-tokyo");
      await settled(page);
      await capture(page, `${breakpoint.name}-long-name-list`, true);

      await page.goto("/styleguide");
      await page
        .locator('[data-specimen="long-name"]')
        .scrollIntoViewIfNeeded();
      await capture(page, `${breakpoint.name}-long-name-impressions`);
    });

    /**
     * The same device, two surfaces.
     *
     * Captured back to back so the framing can be compared directly: the same
     * gutter, the same header, the same section navigation at the foot.
     */
    test("shop and passport framing", async ({ page }) => {
      await page.goto("/shops/ginza-itoya-main-store");
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await capture(page, `${breakpoint.name}-frame-shop`);

      await page.goto("/passport");
      await settled(page);
      await capture(page, `${breakpoint.name}-frame-passport`);
    });

    /** The Passport's initial viewport, with nothing scrolled. */
    test("passport initial viewport", async ({ page }) => {
      await seedPassportView(page, { mode: "book" });
      await page.goto("/passport");
      await settled(page);
      await expect(page.getByRole("button", { name: /open passport/i })).toBeVisible();
      await capture(page, `${breakpoint.name}-passport-initial-viewport`);
    });

    /** The styleguide's impression specimens. */
    test("styleguide", async ({ page }) => {
      await page.goto("/styleguide");
      await page.locator('section[aria-labelledby="stamps"]').scrollIntoViewIfNeeded();
      await page
        .locator('section[aria-labelledby="stamps"]')
        .screenshot({
          path: path.join(OUT_DIR, `${breakpoint.name}-styleguide-impressions.png`),
          animations: "disabled",
        });
    });
  });
}

/**
 * The reduced-height screen.
 *
 * This is where the frame defect actually showed: at 360 × 568 the Passport's
 * book took its own intrinsic height, the document scrolled, and the pager —
 * the way into the book — sat about 140 px below the fold.
 */
test.describe(SHORT.name, () => {
  test.use({ viewport: { width: SHORT.width, height: SHORT.height } });

  test.beforeEach(async ({ page }) => {
    await useNormalMode(page);
    await seedSampleCollection(page);
    await page.emulateMedia({ reducedMotion: "reduce" });
  });

  test("closed book", async ({ page }) => {
    await seedPassportView(page, { mode: "book" });
    await page.goto("/passport");
    await settled(page);
    await expect(page.getByRole("button", { name: /open passport/i })).toBeVisible();
    await capture(page, `${SHORT.name}-passport-initial-viewport`);
  });

  test("open book", async ({ page }) => {
    await seedPassportView(page, { mode: "book", coverSeen: true });
    await page.goto("/passport");
    await settled(page);
    await bookSettled(page);
    await capture(page, `${SHORT.name}-impression-book`);
  });

  test("enlarged impression", async ({ page }) => {
    await page.goto("/passport");
    await settled(page);
    await page
      .getByRole("button", { name: /Ginza Itoya Main Store/ })
      .first()
      .click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await capture(page, `${SHORT.name}-impression-detail`);
  });

  test("shop and passport framing", async ({ page }) => {
    await page.goto("/shops/ginza-itoya-main-store");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await capture(page, `${SHORT.name}-frame-shop`);

    await page.goto("/passport");
    await settled(page);
    await capture(page, `${SHORT.name}-frame-passport`);
  });
});
