import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { stubMagicLink, stubSession } from "../support/auth";
import { seedSampleCollection } from "../support/local-state";

const ROUTES = [
  { path: "/", name: "map" },
  { path: "/saved", name: "saved mode" },
  { path: "/passport", name: "passport" },
  { path: "/passport/jp/chuo-tokyo", name: "passport locality" },
  { path: "/me", name: "me" },
  { path: "/login", name: "sign in" },
  { path: "/privacy", name: "privacy" },
  { path: "/about", name: "about" },
  { path: "/help", name: "help" },
  { path: "/suggest-shop", name: "suggest a shop" },
  { path: "/shops/ty-lee-pen-shop/report", name: "report a listing" },
  { path: "/shops/ginza-itoya-main-store", name: "shop detail" },
  { path: "/shops/skb-kaohsiung", name: "shop detail with omitted fields" },
  { path: "/styleguide", name: "styleguide" },
];

/*
 * Every route is audited with a collection present. An empty Passport is a
 * simpler page than a full one, so auditing the populated state is the stronger
 * check; the clean-device state is covered by its own assertions in
 * `reviewer-mode.spec.ts`.
 */
test.beforeEach(async ({ page }) => {
  await seedSampleCollection(page);
});

/**
 * Waits for a surface's entry animation to finish before auditing it.
 *
 * An overlay is "visible" to Playwright as soon as it has a box, which is while
 * it is still fading in — and a contrast audit taken then reads the half-faded
 * colours rather than the ones the reader sees. Auditing the settled surface is
 * both the honest check and the deterministic one.
 */
async function settled(page: Page, selector: string) {
  await page
    .locator(selector)
    .first()
    .evaluate(async (node) => {
      await Promise.all(
        node
          .getAnimations({ subtree: true })
          .map((animation) => animation.finished.catch(() => undefined)),
      );
    });
}

async function analyze(page: Page) {
  return new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    // The MapLibre canvas is third-party rendering; the equivalent list is the
    // accessible representation of the same results.
    .exclude(".maplibregl-ctrl-attrib")
    .analyze();
}

for (const route of ROUTES) {
  test(`${route.name} has no detectable accessibility violations`, async ({ page }) => {
    // Signed out, so `/login` is audited as the form a reader is offered rather
    // than as the "no accounts in this build" notice the fixture would give it,
    // and Me is audited with its account invitation present.
    await stubSession(page, { kind: "signed-out" });
    await page.goto(route.path);
    await expect(page.getByRole("heading", { includeHidden: true }).first()).toBeAttached();

    const results = await analyze(page);

    expect(
      results.violations.map((violation) => `${violation.id}: ${violation.nodes.length}`),
    ).toEqual([]);
  });
}

/*
 * The search panel is opened by typing, so the route audit above never sees it
 * either — which is how it went unaudited while it was built out of `li`
 * elements inside a `role="listbox"` list. It is now groups of options, and it
 * is audited open, with both groups populated.
 */
test("the search panel is accessible with both result groups open", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("list", { name: /shops in the searched area/i })).toBeVisible();

  await page.getByRole("combobox", { name: /search shops or places/i }).fill("Kaohsiung");

  const listbox = page.getByRole("listbox", { name: /search results/i });
  await expect(listbox).toBeVisible();
  await expect(page.getByRole("group", { name: "Places" })).toBeVisible();
  await expect(page.getByRole("group", { name: "Shops" })).toBeVisible();

  const results = await analyze(page);

  expect(
    results.violations.map((violation) => `${violation.id}: ${violation.nodes.length}`),
  ).toEqual([]);
});

/*
 * The filter drawer is a dialog reached by a control, so the route audit above
 * never sees it. It is audited open, and its keyboard contract is asserted here
 * rather than left to the visual review: focus moves in on open and back to the
 * trigger on close, and Escape closes without applying.
 */
test("the filter drawer is accessible and keyboard-complete", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("list", { name: /shops in the searched area/i })).toBeVisible();

  const handle = page.getByRole("button", { name: /results sheet/i });

  if (await handle.isVisible().catch(() => false)) {
    await handle.click();
  }

  const trigger = page.getByRole("button", { name: /^filters/i });

  await trigger.click();

  const drawer = page.getByRole("dialog", { name: "Filters" });
  await expect(drawer).toBeVisible();
  await settled(page, '[role="dialog"]');

  // The drawer takes focus, so the next Tab lands inside it rather than back at
  // the top of the results.
  await expect(drawer).toBeFocused();
  expect((await analyze(page)).violations).toEqual([]);

  // A drafted change and an Escape: closed, discarded, focus returned.
  await drawer.getByRole("button", { name: "Vintage / Used", exact: true }).click();
  await page.keyboard.press("Escape");

  await expect(drawer).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await expect(page.getByTestId("filter-count")).toHaveCount(0);

  expect((await analyze(page)).violations).toEqual([]);
});

/*
 * Me's signed-in state carries the identity block and the Danger group, neither
 * of which exists in the signed-out audit above. The session is arranged as the
 * answer the application's own route gives, which is the only way to reach this
 * state in a build with no Supabase project behind it.
 */
test("me in its signed-in form is accessible", async ({ page }) => {
  await stubSession(page, { kind: "signed-in", displayName: "Ada Lovelace" });
  await page.goto("/me");

  await expect(
    page.getByRole("region", { name: /^account$/i }).getByText("Ada Lovelace"),
  ).toBeVisible();
  expect((await analyze(page)).violations).toEqual([]);
});

/*
 * The sign-in interruption, in every state a reader can be left in it: the two
 * ways in, a failure reported on the field that caused it, and the confirmation
 * that replaces the form. It is a modal dialog over whatever the reader was
 * doing, so it is audited as its own surface rather than as part of Me.
 */
test("the sign-in interruption is accessible in each of its states", async ({
  page,
}) => {
  await stubSession(page, { kind: "signed-out" });
  await stubMagicLink(page, { kind: "error", status: 400, code: "invalid_email" });
  await page.goto("/me");

  await page
    .getByRole("region", { name: /^account$/i })
    .getByRole("button", { name: /sign in/i })
    .click();

  const dialog = page.getByRole("dialog", { name: /sign in to nib atlas/i });

  await expect(dialog).toBeVisible();
  await settled(page, '[role="dialog"]');
  expect((await analyze(page)).violations).toEqual([]);

  await dialog.getByLabel(/email address/i).fill("ada@");
  await dialog.getByRole("button", { name: /email me a sign-in link/i }).click();

  await expect(page.getByRole("alert", { name: /sign-in error/i })).toBeVisible();
  expect((await analyze(page)).violations).toEqual([]);

  await page.unroute("**/api/v1/auth/magic-link");
  await stubMagicLink(page);
  await dialog.getByLabel(/email address/i).fill("ada@example.com");
  await dialog.getByRole("button", { name: /email me a sign-in link/i }).click();

  await expect(page.getByRole("dialog", { name: /check your email/i })).toBeVisible();
  expect((await analyze(page)).violations).toEqual([]);
});

/*
 * The callback's result is announced over whatever page it returned to, and the
 * failure form of it carries a control. Audited on the map, which is the busiest
 * surface it can land on.
 */
test("the callback's result banner is accessible over the map", async ({ page }) => {
  await stubSession(page, { kind: "signed-out" });
  await page.goto("/?authError=expired_link");

  await expect(page.getByRole("alert", { name: /sign-in result/i })).toContainText(
    /expired/i,
  );
  expect((await analyze(page)).violations).toEqual([]);
});

/*
 * Both Passport modes, and the overlay that sits over either of them. The route
 * audit above covers List, which is what a normal device lands in; Book mode and
 * the enlarged impression are separate surfaces reached by a control.
 */
test("both Passport modes, the enlarged stamp and a seal are accessible", async ({
  page,
}) => {
  await page.goto("/passport");

  await page.getByRole("button", { name: /Ginza Itoya Main Store/ }).first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await settled(page, '[role="dialog"]');
  expect((await analyze(page)).violations).toEqual([]);

  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);

  // A derived seal opens the same overlay with different content, so it is its
  // own audit.
  await page.getByRole("button", { name: /^Country seal,/ }).first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await settled(page, '[role="dialog"]');
  expect((await analyze(page)).violations).toEqual([]);

  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);

  await page
    .getByRole("group", { name: "Passport view" })
    .getByRole("button", { name: "Book", exact: true })
    .click();
  await page.getByRole("button", { name: /open passport/i }).click();
  await expect(page.getByRole("button", { name: /previous page/i })).toBeVisible();
  expect((await analyze(page)).violations).toEqual([]);

  await page.getByRole("button", { name: /^contents$/i }).click();
  await expect(page.getByRole("heading", { name: "Contents" })).toBeVisible();
  expect((await analyze(page)).violations).toEqual([]);
});


test("the collection dialogs are accessible", async ({ page }) => {
  await page.goto("/shops/juspirit-banqiao");
  await page.getByRole("button", { name: /^collect stamp$/i }).click();

  await expect(page.getByRole("dialog", { name: /before you collect/i })).toBeVisible();
  await settled(page, '[role="dialog"]');

  expect((await analyze(page)).violations).toEqual([]);

  await page.getByRole("button", { name: /^i am at this shop$/i }).click();

  await expect(page.getByRole("dialog", { name: /impression collected/i })).toBeVisible();
  // The ceremony now shares `ImpressionSheet` with the Passport's overlays, so
  // it has the same entrance — and the same reason to be audited settled.
  await settled(page, '[role="dialog"]');

  expect((await analyze(page)).violations).toEqual([]);
});

test("the collection preflight traps focus and gives it back", async ({ page }) => {
  await page.goto("/shops/nagasawa-penstyle-den");

  const trigger = page.getByRole("button", { name: /^collect stamp$/i });
  await trigger.click();

  const dialog = page.getByRole("dialog", { name: /before you collect/i });
  await expect(dialog).toBeFocused();

  // Tabbing repeatedly can never leave the dialog.
  for (let press = 0; press < 6; press += 1) {
    await page.keyboard.press("Tab");
    await expect(dialog).toContainText("Before you collect");
    expect(
      await page.evaluate(() => {
        const active = document.activeElement;
        return active?.closest('[role="dialog"]') !== null;
      }),
    ).toBe(true);
  }

  await page.keyboard.press("Shift+Tab");
  expect(
    await page.evaluate(
      () => document.activeElement?.closest('[role="dialog"]') !== null,
    ),
  ).toBe(true);

  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test("the stamp ceremony returns focus to the shop page", async ({ page }) => {
  await page.goto("/shops/ty-lee-pen-shop");

  const trigger = page.getByRole("button", { name: /^collect stamp$/i });
  await trigger.click();
  await page.getByRole("button", { name: /^i am at this shop$/i }).click();

  const ceremony = page.getByRole("dialog", { name: /impression collected/i });
  await expect(ceremony).toBeFocused();

  await page.keyboard.press("Escape");
  await expect(ceremony).toHaveCount(0);
  await expect(page.getByRole("button", { name: /view atlas stamp/i })).toBeFocused();
});

test("the Passport book is reachable and operable from the keyboard", async ({ page }) => {
  await page.goto("/passport");

  // The toggle is the first thing on the screen, and it is operable by keyboard
  // in both directions.
  const bookToggle = page
    .getByRole("group", { name: "Passport view" })
    .getByRole("button", { name: "Book", exact: true });
  await bookToggle.focus();
  await expect(bookToggle).toBeFocused();
  await page.keyboard.press("Enter");

  const openButton = page.getByRole("button", { name: /open passport/i });
  await openButton.focus();
  await expect(openButton).toBeFocused();
  await page.keyboard.press("Enter");

  await expect(page.getByRole("button", { name: /previous page/i })).toBeVisible();
  expect((await analyze(page)).violations).toEqual([]);
});

/** Every standalone control on the page that is under 44 px in either axis. */
async function undersizedControls(page: Page) {
  return page.evaluate(() => {
    const failures: string[] = [];

    for (const element of document.querySelectorAll("button, a[href]")) {
      const rect = element.getBoundingClientRect();

      // Links that sit inside a paragraph are inline prose links, which WCAG
      // exempts from the target-size minimum. Standalone controls are not.
      if (rect.width === 0 || element.closest("p") !== null) {
        continue;
      }

      // The scrim behind a modal is a full-bleed dismissal affordance that is
      // hidden from assistive technology and never the accessible route out.
      if (element.getAttribute("aria-hidden") === "true") {
        continue;
      }

      // Rounded before comparing: a 2.75 rem box measures 43.99 px at some
      // device pixel ratios, and that is a 44 px target.
      if (Math.round(rect.height) < 44 || Math.round(rect.width) < 44) {
        failures.push(
          `${element.tagName}: ${
            element.textContent?.trim().slice(0, 40) ||
            element.getAttribute("aria-label")
          } (${Math.round(rect.width)}x${Math.round(rect.height)})`,
        );
      }
    }

    return failures;
  });
}

test("every control meets the minimum touch target size", async ({ page }) => {
  await page.goto("/shops/ginza-itoya-main-store");

  expect(await undersizedControls(page)).toEqual([]);
});

/**
 * The same audit across the surfaces WP5 touched.
 *
 * The Passport's own List/Book control was 38 px high — the tap target token
 * less six, so the pill would sit tight inside its track — which put the one
 * control that switches the Passport's mode under the minimum `BRAND.md` sets
 * for every control in the product.
 */
test("the Passport and its overlays meet it too", async ({ page }) => {
  await seedSampleCollection(page);
  await page.goto("/passport");
  await expect(page.getByRole("group", { name: "Passport view" })).toBeVisible();

  expect(await undersizedControls(page)).toEqual([]);

  await page.getByRole("button", { name: /Ginza Itoya Main Store/ }).first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
  expect(await undersizedControls(page)).toEqual([]);

  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: /country seal/i }).first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
  expect(await undersizedControls(page)).toEqual([]);

  await page.keyboard.press("Escape");
  await page
    .getByRole("group", { name: "Passport view" })
    .getByRole("button", { name: "Book", exact: true })
    .click();
  await page.getByRole("button", { name: /open passport/i }).click();
  await expect(page.getByRole("button", { name: /previous page/i })).toBeVisible();

  expect(await undersizedControls(page)).toEqual([]);
});
