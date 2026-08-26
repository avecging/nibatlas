import { mkdir } from "node:fs/promises";
import path from "node:path";

import { expect, test, type Page } from "@playwright/test";

import { REVIEWER_STORAGE_KEY } from "../../src/features/reviewer/reviewer-mode";
import { seedSampleCollection } from "../support/local-state";

/**
 * WP1 review evidence: the same pages with reviewer mode off and on.
 *
 * Not an assertion suite. It writes paired screenshots into
 * `docs/evidence/milestone-1-5-wp1/` so the founder can read the difference
 * between what a tester sees and what internal review sees, side by side, at the
 * two breakpoints the review cares about.
 *
 * Opted into with `EVIDENCE=1 pnpm test:e2e --project=evidence`.
 *
 * The 1440 × 900 captures are evidence of the copy and visibility pass only.
 * `docs/milestone-1-5-product-refinement.md` records the desktop treatment as
 * not designed and not approved; WP-D owns that, and nothing here is sign-off.
 */
const OUT_DIR = path.join(process.cwd(), "docs", "evidence", "milestone-1-5-wp1");

const BREAKPOINTS = [
  { name: "m", width: 360, height: 800 },
  { name: "d", width: 1440, height: 900 },
] as const;

const SCREENS = [
  { name: "map", path: "/", fullPage: false },
  { name: "shop", path: "/shops/ginza-itoya-main-store", fullPage: true },
  { name: "shop-omitted", path: "/shops/skb-kaohsiung", fullPage: true },
  { name: "me", path: "/me", fullPage: true },
  { name: "passport", path: "/passport", fullPage: false },
  { name: "privacy", path: "/privacy", fullPage: true },
  { name: "about", path: "/about", fullPage: true },
] as const;

/**
 * Seeds the device choice before the first script runs, so the page resolves
 * straight into the intended mode instead of being toggled after paint.
 */
async function seedMode(page: Page, reviewer: boolean) {
  await page.addInitScript(
    ([key, value]) => {
      try {
        window.localStorage.setItem(key as string, value as string);
      } catch {
        // Nothing to do: the default is the product.
      }
    },
    [REVIEWER_STORAGE_KEY, reviewer ? "1" : "0"],
  );
}

test.beforeAll(async () => {
  await mkdir(OUT_DIR, { recursive: true });
});

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  /*
   * The pairs are about copy and visibility, so both sides carry the same
   * collection. A clean device now starts empty in normal mode, and comparing an
   * empty Passport against a seeded one would show that difference instead of
   * the one under review; the clean-start behaviour has its own capture below.
   */
  await seedSampleCollection(page);
  await seedSampleCollection(page, "reviewer");
});

for (const breakpoint of BREAKPOINTS) {
  for (const mode of ["off", "on"] as const) {
    for (const screen of SCREENS) {
      test(`${screen.name} ${breakpoint.name} reviewer-${mode}`, async ({ page }) => {
        await seedMode(page, mode === "on");
        await page.setViewportSize({ width: breakpoint.width, height: breakpoint.height });
        await page.goto(screen.path);

        await expect(page.locator("[data-reviewer-mode]")).toHaveAttribute(
          "data-reviewer-mode",
          mode,
        );

        if (screen.path === "/") {
          await expect(
            page.getByRole("list", { name: /shops in the searched area/i }),
          ).toBeVisible();
          await expect(page.getByTestId("explore")).toHaveAttribute(
            "data-explore-status",
            "idle",
          );
        }

        await page.screenshot({
          path: path.join(
            OUT_DIR,
            `${breakpoint.name}-${screen.name}-reviewer-${mode}.png`,
          ),
          fullPage: screen.fullPage,
          animations: "disabled",
        });
      });
    }

    test(`collect-preflight ${breakpoint.name} reviewer-${mode}`, async ({ page }) => {
      await seedMode(page, mode === "on");
      await page.setViewportSize({ width: breakpoint.width, height: breakpoint.height });
      await page.goto("/shops/nagasawa-penstyle-den");

      await expect(page.locator("[data-reviewer-mode]")).toHaveAttribute(
        "data-reviewer-mode",
        mode,
      );

      await page
        .getByRole("button", {
          name: mode === "on" ? /collect stamp \(simulated\)/i : /^collect stamp$/i,
        })
        .click();
      await expect(page.getByRole("dialog", { name: /before you collect/i })).toBeVisible();

      await page.screenshot({
        path: path.join(
          OUT_DIR,
          `${breakpoint.name}-collect-preflight-reviewer-${mode}.png`,
        ),
        animations: "disabled",
      });
    });
  }
}

/**
 * The clean-device state, which is the change reviewer mode is *not* about.
 *
 * A tester who has just been handed the link starts with an empty Passport and
 * nothing saved. Captured on its own so the founder can see the first-run
 * experience separately from the copy pass.
 */
for (const breakpoint of BREAKPOINTS) {
  for (const screen of [
    { name: "clean-passport", path: "/passport" },
    { name: "clean-me", path: "/me" },
    { name: "clean-saved", path: "/saved" },
  ] as const) {
    test(`${screen.name} ${breakpoint.name}`, async ({ page }) => {
      // Overrides the shared arrangement: this is the untouched device.
      await page.addInitScript(() => {
        try {
          window.localStorage.clear();
          window.sessionStorage.clear();
        } catch {
          // Nothing to clear.
        }
      });
      await page.setViewportSize({ width: breakpoint.width, height: breakpoint.height });
      await page.goto(screen.path);

      await expect(page.locator("[data-reviewer-mode]")).toHaveAttribute(
        "data-reviewer-mode",
        "off",
      );

      await page.screenshot({
        path: path.join(OUT_DIR, `${breakpoint.name}-${screen.name}.png`),
        fullPage: screen.path === "/me",
        animations: "disabled",
      });
    });
  }
}
