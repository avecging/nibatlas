import { mkdir } from "node:fs/promises";
import path from "node:path";

import { expect, test, type Page } from "@playwright/test";

import { seedSampleCollection, useNormalMode } from "../support/local-state";

/**
 * WP4 review evidence: the shop page as a pen-specific guide.
 *
 * Not an assertion suite — `tests/e2e/shop-value.spec.ts` holds the verdicts.
 * This writes screenshots into `docs/evidence/milestone-1-5-wp4/` so the founder
 * can read the reordered page, the interim identity treatment, the gap state and
 * the specimen value layer side by side at the three breakpoints
 * `IMPLEMENTATION-PLAN.md` names.
 *
 * Revised after the founder's staging reviews: the actions are in the header, the
 * Collect Stamp action is Plum before collection and the Vermilion visited step
 * after it, *Plan your visit* has replaced the fragmented practical cards, the
 * Save bookmark leads a fixed title row, operational status has three levels of
 * attention, and the preflight confirms in Atlas Navy.
 *
 * Opted into with `EVIDENCE=1 pnpm test:e2e --project=evidence`.
 *
 * The 768 × 1024 and 1440 × 900 captures show responsive integrity only.
 * `docs/milestone-1-5-product-refinement.md` records the desktop treatment as
 * not designed and not approved; WP-D owns that, and nothing here is sign-off.
 */
const OUT_DIR = path.join(process.cwd(), "docs", "evidence", "milestone-1-5-wp4");

const BREAKPOINTS = [
  { name: "m", width: 360, height: 800 },
  { name: "t", width: 768, height: 1024 },
  { name: "d", width: 1440, height: 900 },
] as const;

test.beforeAll(async () => {
  await mkdir(OUT_DIR, { recursive: true });
});

async function capture(page: Page, name: string, fullPage = true) {
  await page.screenshot({
    path: path.join(OUT_DIR, `${name}.png`),
    fullPage,
    animations: "disabled",
  });
}

/** Waits for the identity plate, which is the first thing the page renders. */
async function settled(page: Page, name: string) {
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
  await expect(page.getByText("Photos coming soon")).toBeVisible();
}

for (const breakpoint of BREAKPOINTS) {
  test.describe(breakpoint.name, () => {
    test.use({ viewport: { width: breakpoint.width, height: breakpoint.height } });

    /** The fullest record in the catalogue: description, hours, official link. */
    test("a sourced shop, reordered", async ({ page }) => {
      await useNormalMode(page);
      await page.goto("/shops/ginza-itoya-main-store");
      await settled(page, "Ginza Itoya Main Store");

      await capture(page, `${breakpoint.name}-shop-sourced`);
    });

    /** Two shops in one city: the trip-planning context, with a distance. */
    test("nearby pen shops, measured", async ({ page }) => {
      await useNormalMode(page);
      await page.goto("/shops/aesthetic-bay");
      await settled(page, "Aesthetic Bay");

      await expect(page.getByRole("list", { name: "Nearby pen shops" })).toBeVisible();
      await capture(page, `${breakpoint.name}-shop-nearby`);
    });

    /** The thinnest record: what the page says when it knows least. */
    test("a shop with almost nothing sourced", async ({ page }) => {
      await useNormalMode(page);
      await page.goto("/shops/skb-kaohsiung");
      await settled(page, "SKB");

      await expect(page.getByTestId("shop-value-gap")).toBeVisible();
      await capture(page, `${breakpoint.name}-shop-gap`);
    });

    /**
     * A collected shop: the post-collection state.
     *
     * `View Atlas Stamp` on the restrained Vermilion visited surface, the
     * collected line beneath it, and the Save bookmark in its saved state — the
     * outcome colours, none of them the Plum invitation.
     */
    test("a visited shop", async ({ page }) => {
      await useNormalMode(page);
      await seedSampleCollection(page);
      await page.goto("/shops/pen-house-tainan");
      await settled(page, "Pen House");

      await expect(
        page.getByRole("button", { name: /view atlas stamp/i }),
      ).toBeVisible();
      await capture(page, `${breakpoint.name}-shop-visited`);
    });

    /**
     * The header, close up.
     *
     * What the staging review was about: the Save bookmark beside the name, then
     * Directions and the Plum Collect Stamp, all above the sections rather than
     * stranded below the practical detail.
     */
    test("the revised header and actions", async ({ page }) => {
      await useNormalMode(page);
      await page.goto("/shops/aesthetic-bay");
      await settled(page, "Aesthetic Bay");

      await expect(
        page.getByRole("button", { name: /^collect stamp$/i }),
      ).toBeVisible();
      await capture(page, `${breakpoint.name}-header-actions`, false);
    });

    /**
     * The preflight, where the confirmation is Atlas Navy.
     *
     * A confirmation of intent, not the collectible action and not a successful
     * verification — so not Plum, which the header control keeps.
     */
    test("the collection preflight", async ({ page }) => {
      await useNormalMode(page);
      await page.goto("/shops/aesthetic-bay");
      await settled(page, "Aesthetic Bay");

      await page.getByRole("button", { name: /^collect stamp$/i }).click();
      await expect(
        page.getByRole("dialog", { name: /before you collect/i }),
      ).toBeVisible();
      // Off the confirm button, so it is captured in its resting state.
      await page.mouse.move(0, 0);

      await capture(page, `${breakpoint.name}-preflight`, false);
    });

    /**
     * The title row under pressure.
     *
     * A long Japanese name that wraps: the bookmark holds its own column rather
     * than being pushed beneath the name, which is what the second staging
     * review found.
     */
    test("a long name beside the bookmark", async ({ page }) => {
      await useNormalMode(page);
      await page.goto("/shops/ginza-itoya-yokohama-motomachi");
      await settled(page, "Ginza Itoya Yokohama Motomachi");

      await capture(page, `${breakpoint.name}-long-name-title`, false);
    });
  });
}

/**
 * The populated value layer.
 *
 * Captured from the styleguide, because no source in the prototype catalogue
 * publishes a service, an in-store experience or a shop-only item, and accepted
 * decision 4 forbids inventing them for a real shop.
 */
test.describe("specimen", () => {
  test.use({ viewport: { width: 900, height: 1200 } });

  test("value layer, populated and empty", async ({ page }) => {
    await useNormalMode(page);
    await page.goto("/styleguide");

    const section = page.getByRole("region", { name: "Shop value layer" });

    await expect(section).toBeVisible();
    await section.scrollIntoViewIfNeeded();
    await section.screenshot({
      path: path.join(OUT_DIR, "s-value-layer-specimen.png"),
      animations: "disabled",
    });
  });
});
