import { expect, test } from "@playwright/test";

import {
  seedPassportView,
  seedSampleCollection,
  seedSignedInPreview,
} from "../support/local-state";

/**
 * Visual baselines and responsive screenshot evidence.
 *
 * Not part of the default `pnpm test:e2e` run: rendering differs between
 * container images, so baselines are opted into with `VISUAL=1 pnpm test:e2e`
 * and refreshed with `VISUAL=1 pnpm test:e2e --update-snapshots`.
 *
 * The committed baselines under `breakpoints.spec.ts-snapshots/` were captured
 * in the Linux container this branch was developed in, against a production
 * build. They are review evidence and a local regression net, not a CI gate: a
 * different image needs `--update-snapshots` once before the suite passes there.
 *
 * The offline "field journal" basemap is deterministic, so the map is captured
 * as rendered; `maxDiffPixelRatio` absorbs sub-pixel renderer differences.
 */
const BREAKPOINTS = [
  { name: "mobile-360x800", width: 360, height: 800 },
  { name: "tablet-768x1024", width: 768, height: 1024 },
  { name: "desktop-1440x900", width: 1440, height: 900 },
];

const SCREENS = [
  { name: "map", path: "/" },
  { name: "saved-mode", path: "/saved" },
  { name: "shop-detail", path: "/shops/ginza-itoya-main-store" },
  { name: "shop-detail-omitted", path: "/shops/skb-kaohsiung" },
  // List is what a normal device lands in, so it is the Passport baseline.
  { name: "passport-list", path: "/passport" },
  { name: "me", path: "/me" },
  { name: "privacy", path: "/privacy" },
  { name: "about", path: "/about" },
  { name: "styleguide", path: "/styleguide" },
];

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  // Baselines are more useful with a populated Passport and Saved mode than with
  // the empty states a clean device now starts in.
  await seedSampleCollection(page);
});

for (const breakpoint of BREAKPOINTS) {
  for (const screen of SCREENS) {
    test(`${screen.name} at ${breakpoint.name}`, async ({ page }) => {
      await page.setViewportSize({ width: breakpoint.width, height: breakpoint.height });
      await page.goto(screen.path);
      await expect(
        page.getByRole("heading", { includeHidden: true }).first(),
      ).toBeAttached();

      if (screen.path === "/") {
        await expect(
          page.getByRole("list", { name: /shops in the searched area/i }),
        ).toBeVisible();
        await expect(page.getByTestId("explore")).toHaveAttribute(
          "data-explore-status",
          "idle",
        );
      }

      await expect(page).toHaveScreenshot(`${screen.name}-${breakpoint.name}.png`, {
        fullPage: screen.path !== "/" && screen.path !== "/saved",
        animations: "disabled",
        maxDiffPixelRatio: 0.02,
      });
    });
  }
}

/*
 * Book mode's closed cover is the other Passport surface, and it is the one WP3
 * redesigned: textured stock, an issuing line, the mark, PASSPORT and VOLUME I,
 * with the two foil rules removed. It needs its own baseline because it is
 * reached by a choice rather than by a route.
 */
for (const breakpoint of BREAKPOINTS) {
  test(`passport-book-closed at ${breakpoint.name}`, async ({ page }) => {
    await seedPassportView(page, { mode: "book" });
    await page.setViewportSize({ width: breakpoint.width, height: breakpoint.height });
    await page.goto("/passport");
    await expect(page.getByRole("button", { name: /open passport/i })).toBeVisible();

    await expect(page).toHaveScreenshot(
      `passport-book-closed-${breakpoint.name}.png`,
      { animations: "disabled", maxDiffPixelRatio: 0.02 },
    );
  });
}

/*
 * The impression family, as baselines.
 *
 * WP5's whole subject is material that has to look like one system, and a
 * screenshot is the only thing that can regress it. Three states: the Passport's
 * book open on a locality page, where impressions sit on the leaf itself; the
 * enlarged shop impression; and the enlarged country seal, which has to stay
 * recognisably a different artefact on the same paper.
 */
for (const breakpoint of BREAKPOINTS) {
  test(`passport-book-open at ${breakpoint.name}`, async ({ page }) => {
    await seedPassportView(page, { mode: "book", coverSeen: true });
    await page.setViewportSize({ width: breakpoint.width, height: breakpoint.height });
    await page.goto("/passport");
    await expect(page.getByRole("button", { name: /^cover$/i })).toBeVisible();

    await expect(page).toHaveScreenshot(`passport-book-open-${breakpoint.name}.png`, {
      animations: "disabled",
      maxDiffPixelRatio: 0.02,
    });
  });

  test(`impression-detail at ${breakpoint.name}`, async ({ page }) => {
    await page.setViewportSize({ width: breakpoint.width, height: breakpoint.height });
    await page.goto("/passport");
    await page
      .getByRole("button", { name: /Ginza Itoya Main Store/ })
      .first()
      .click();
    await expect(page.getByRole("dialog")).toBeVisible();

    await expect(page).toHaveScreenshot(`impression-detail-${breakpoint.name}.png`, {
      animations: "disabled",
      maxDiffPixelRatio: 0.02,
    });
  });

  test(`seal-detail at ${breakpoint.name}`, async ({ page }) => {
    await page.setViewportSize({ width: breakpoint.width, height: breakpoint.height });
    await page.goto("/passport");
    await page.getByRole("button", { name: /country seal/i }).first().click();
    await expect(page.getByRole("dialog")).toBeVisible();

    await expect(page).toHaveScreenshot(`seal-detail-${breakpoint.name}.png`, {
      animations: "disabled",
      maxDiffPixelRatio: 0.02,
    });
  });
}

/*
 * A reduced-height mobile screen.
 *
 * The Passport's book took its own intrinsic height rather than the frame's, so
 * on a viewport shorter than the three breakpoints — which is every real phone
 * showing its browser chrome — the Passport became a scrolling document and its
 * pager fell below the fold. This baseline is the one that would show that
 * coming back.
 */
test("passport-book-short at mobile-360x568", async ({ page }) => {
  await seedPassportView(page, { mode: "book", coverSeen: true });
  await page.setViewportSize({ width: 360, height: 568 });
  await page.goto("/passport");
  await expect(page.getByRole("button", { name: /^cover$/i })).toBeVisible();

  await expect(page).toHaveScreenshot("passport-book-short-mobile-360x568.png", {
    animations: "disabled",
    maxDiffPixelRatio: 0.02,
  });
});

/*
 * Me's signed-in state is a different screen, not the same screen with extra
 * rows, so it gets its own baseline. It is reachable only through the reviewer
 * preview until Milestone 4 builds authentication, and the reviewer badge and
 * prototype controls are part of what the baseline records.
 */
for (const breakpoint of BREAKPOINTS) {
  test(`me-signed-in at ${breakpoint.name}`, async ({ page }) => {
    await seedSignedInPreview(page, "Ada Lovelace");
    await page.setViewportSize({ width: breakpoint.width, height: breakpoint.height });
    await page.goto("/me");
    await expect(page.getByLabel(/display name/i)).toBeVisible();

    await expect(page).toHaveScreenshot(`me-signed-in-${breakpoint.name}.png`, {
      fullPage: true,
      animations: "disabled",
      maxDiffPixelRatio: 0.02,
    });
  });
}
