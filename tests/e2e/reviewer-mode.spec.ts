import { expect, test, type Page } from "@playwright/test";

/**
 * WP1 acceptance: reviewer mode, and the production-like default.
 *
 * Every test starts from a clean device — Playwright gives each test a fresh
 * context, so local storage is empty unless a test puts something there. That
 * is the state a non-technical tester arrives in.
 */

/** Pages a tester would actually pass through, plus the shell that frames them. */
const PRODUCT_ROUTES = [
  "/",
  "/saved",
  "/passport",
  "/passport/jp/chuo-tokyo",
  "/me",
  "/privacy",
  "/about",
  "/shops/ginza-itoya-main-store",
  "/shops/skb-kaohsiung",
];

/**
 * Every string WP1 moves behind reviewer mode.
 *
 * Written as one list, checked on every product route, so a future change that
 * reintroduces any of it anywhere fails here rather than on staging.
 */
const REVIEWER_ONLY_PATTERNS: readonly { readonly name: string; readonly pattern: RegExp }[] = [
  { name: "prototype and demo badges", pattern: /\bprototype\b/i },
  { name: "demo wording", pattern: /\bdemo\b/i },
  { name: "simulation diagnostics", pattern: /simulat/i },
  { name: "milestone labels", pattern: /milestone/i },
  { name: "fixture terminology", pattern: /\bfixture\b/i },
  { name: "coverage-set version strings", pattern: /curated set [a-z]{2}-/i },
  { name: "coordinate diagnostics", pattern: /surveyed coordinate/i },
  { name: "approximate-position rows", pattern: /Map position/i },
  { name: "per-field source dumps", pattern: /confirms /i },
  { name: "offline-basemap diagnostics", pattern: /no tile provider configured/i },
];

/** The reviewer marker, if reviewer mode resolved on. */
const reviewerBadge = (page: Page) => page.getByTestId("reviewer-mode-badge");

/**
 * Reviewer mode resolves after mount, so a test must wait for the shell to
 * report a resolved state rather than sampling the first paint.
 */
async function expectMode(page: Page, expected: "on" | "off") {
  await expect(page.locator("[data-reviewer-mode]")).toHaveAttribute(
    "data-reviewer-mode",
    expected,
  );
}

async function visibleText(page: Page): Promise<string> {
  await expect(page.getByRole("heading", { includeHidden: true }).first()).toBeAttached();

  return (await page.locator("body").innerText()).replace(/\s+/g, " ");
}

test.describe("reviewer mode flag", () => {
  test("is off by default on a clean device", async ({ page }) => {
    await page.goto("/me");

    await expectMode(page, "off");
    await expect(reviewerBadge(page)).toHaveCount(0);
    // Nothing offers a normal tester a way into reviewer mode.
    await expect(page.getByRole("button", { name: /reviewer mode/i })).toHaveCount(0);
  });

  test("?review=1 enables it and it survives navigation and a reload", async ({ page }) => {
    await page.goto("/me?review=1");
    await expectMode(page, "on");
    await expect(reviewerBadge(page).first()).toBeVisible();

    // Client-side navigation, with no parameter on the target URL.
    await page.getByRole("link", { name: /about nib atlas/i }).click();
    await expect(page).toHaveURL(/\/about$/);
    await expectMode(page, "on");

    // A fresh document load, still with no parameter.
    await page.goto("/passport");
    await expectMode(page, "on");

    await page.reload();
    await expectMode(page, "on");
  });

  test("?review=0 disables it and remembers that", async ({ page }) => {
    await page.goto("/me?review=1");
    await expectMode(page, "on");

    await page.goto("/me?review=0");
    await expectMode(page, "off");

    await page.goto("/privacy");
    await expectMode(page, "off");

    await page.reload();
    await expectMode(page, "off");
    await expect(reviewerBadge(page)).toHaveCount(0);
  });

  test("the discreet exit control turns it off for the device", async ({ page }) => {
    await page.goto("/me?review=1");
    await expectMode(page, "on");

    await page
      .getByRole("button", { name: /exit reviewer mode/i })
      .first()
      .click();

    await expectMode(page, "off");

    // The choice persists: a later visit with no parameter stays off.
    await page.goto("/me");
    await expectMode(page, "off");
  });

  test("an unrecognised value falls through to the remembered choice", async ({ page }) => {
    await page.goto("/me?review=1");
    await expectMode(page, "on");

    await page.goto("/me?review=banana");
    await expectMode(page, "on");
  });
});

test.describe("normal mode is the product", () => {
  for (const path of PRODUCT_ROUTES) {
    test(`${path} carries no reviewer-only material`, async ({ page }) => {
      await page.goto(path);
      await expectMode(page, "off");

      const text = await visibleText(page);

      for (const { name, pattern } of REVIEWER_ONLY_PATTERNS) {
        expect(pattern.test(text), `${path} exposes ${name}: ${pattern}`).toBe(false);
      }

      await expect(page.getByTestId("reviewer-note")).toHaveCount(0);
      await expect(page.getByTestId("shop-provenance-detail")).toHaveCount(0);
      await expect(page.getByTestId("basemap-diagnostic")).toHaveCount(0);
    });
  }

  test("Me offers no prototype reset control", async ({ page }) => {
    await page.goto("/me");
    await expectMode(page, "off");

    // Absent from the document, not merely hidden: a control a tester can reach
    // by keyboard is a control they can press.
    await expect(page.getByRole("button", { name: /reset the prototype/i })).toHaveCount(0);
    await expect(page.getByRole("region", { name: /prototype controls/i })).toHaveCount(0);
  });

  test("a shop page keeps one quiet provenance line and no source dump", async ({ page }) => {
    await page.goto("/shops/ginza-itoya-main-store");
    await expectMode(page, "off");

    await expect(
      page.getByText(/Details from the shop's own website, checked \d+ \w+ \d{4}\./),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: /where this came from/i })).toHaveCount(0);
  });
});

test.describe("reviewer mode keeps the diagnostics", () => {
  test("Me restores the milestone labels, coverage version, and reset control", async ({
    page,
  }) => {
    await page.goto("/me?review=1");
    await expectMode(page, "on");

    await expect(page.getByText("Sign-in arrives in Milestone 4")).toBeVisible();
    await expect(
      page.getByText(/Counted against curated set [a-z]{2}-/i).first(),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: /reset the prototype/i })).toBeVisible();
    await expect(page.getByText(/does not request your location at all/i)).toBeVisible();
  });

  test("a shop page restores the coordinate row and the per-field source list", async ({
    page,
  }) => {
    await page.goto("/shops/ginza-itoya-main-store?review=1");
    await expectMode(page, "on");

    await expect(page.getByText(/Map position/)).toBeVisible();
    await expect(page.getByText(/Not a surveyed coordinate/)).toBeVisible();
    await expect(page.getByTestId("shop-provenance-detail")).toBeVisible();
    await expect(page.getByText(/confirms /).first()).toBeVisible();
    await expect(page.getByText("Prototype catalogue")).toBeVisible();
  });

  test("Map restores the basemap diagnostic and the sample marker", async ({ page }) => {
    await page.goto("/?review=1");
    await expectMode(page, "on");

    // Map hides the shell header below 1024 px, so the marker in the map overlay
    // is the one that has to be reachable — not whichever comes first in the DOM.
    const strip = page.getByTestId("reviewer-strip");

    await expect(strip.getByTestId("basemap-diagnostic")).toBeVisible();
    await expect(strip.getByTestId("reviewer-mode-badge")).toBeVisible();
    await expect(strip.getByRole("button", { name: /exit/i })).toBeVisible();
  });

  test("Privacy restores the build note", async ({ page }) => {
    await page.goto("/privacy?review=1");
    await expectMode(page, "on");

    await expect(page.getByTestId("reviewer-note")).toBeVisible();
    await expect(page.getByText(/frontend prototype/i)).toBeVisible();
  });
});

test.describe("the collection journey works in both modes", () => {
  for (const mode of ["off", "on"] as const) {
    test(`collects an impression with reviewer mode ${mode}`, async ({ page }) => {
      await page.goto(`/shops/ty-lee-pen-shop${mode === "on" ? "?review=1" : ""}`);
      await expectMode(page, mode);

      const collectLabel = mode === "on" ? /collect stamp \(simulated\)/i : /^collect stamp$/i;
      const confirmLabel =
        mode === "on" ? /simulate: i am at this shop/i : /^i am at this shop$/i;

      await page.getByRole("button", { name: collectLabel }).click();
      await expect(page.getByRole("dialog", { name: /before you collect/i })).toBeVisible();

      await page.getByRole("button", { name: confirmLabel }).click();

      const ceremony = page.getByRole("dialog", { name: /impression collected/i });
      await expect(ceremony).toBeVisible();
      await expect(ceremony.getByRole("link", { name: /open in passport/i })).toBeVisible();

      await page.keyboard.press("Escape");
      await expect(page.getByRole("button", { name: /view atlas stamp/i })).toBeVisible();
    });
  }

  test("normal-mode collection copy is brief and does not claim a location check", async ({
    page,
  }) => {
    await page.goto("/shops/juspirit-banqiao");
    await expectMode(page, "off");

    await page.getByRole("button", { name: /^collect stamp$/i }).click();

    const dialog = page.getByRole("dialog", { name: /before you collect/i });
    await expect(dialog).toBeVisible();

    const body = (await dialog.innerText()).replace(/\s+/g, " ");

    // Honest about what has and has not happened.
    expect(body).toMatch(/not running yet/i);
    expect(body).toMatch(/not a verified visit/i);

    // Brief: two short paragraphs, no essay on simulation, milestones, or
    // location architecture.
    expect(body).not.toMatch(/simulat/i);
    expect(body).not.toMatch(/milestone/i);
    expect(body).not.toMatch(/prototype/i);
    expect(body.length).toBeLessThan(600);

    // The fuller explanation is one tap away rather than reproduced here.
    await expect(dialog.getByRole("link", { name: /how location is used/i })).toHaveAttribute(
      "href",
      "/privacy",
    );

    await page.getByRole("button", { name: /^i am at this shop$/i }).click();
    const ceremony = page.getByRole("dialog", { name: /impression collected/i });

    await expect(ceremony).toBeVisible();
    await expect(ceremony.getByText(/your location was not checked/i)).toBeVisible();
  });
});

test.describe("product-facing destinations", () => {
  test("Privacy keeps the fuller location explanation", async ({ page }) => {
    await page.goto("/privacy");
    await expectMode(page, "off");

    await expect(
      page.getByRole("heading", { name: /when location is used/i }),
    ).toBeVisible();
    await expect(page.getByText(/Raw coordinates are never stored/i)).toBeVisible();
    await expect(page.getByText(/no background location/i)).toBeVisible();
    await expect(page.getByText(/checked against that shop/i)).toBeVisible();
    await expect(page.getByText(/not running in this build/i)).toBeVisible();
  });

  test("About Nib Atlas is reachable from Me and uses product language", async ({ page }) => {
    await page.goto("/me");
    await expectMode(page, "off");

    await page.getByRole("link", { name: /about nib atlas/i }).click();
    await expect(page).toHaveURL(/\/about$/);

    await expect(page.getByRole("heading", { name: /about nib atlas/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /what the catalogue is/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /where it covers today/i })).toBeVisible();

    const text = await visibleText(page);

    // Product-facing: the three launch countries by name, and none of the
    // vocabulary the implementation uses about itself.
    for (const country of ["Singapore", "Japan", "Taiwan"]) {
      expect(text).toContain(country);
    }
    expect(text).not.toMatch(/milestone|fixture|prototype|coverage set/i);

    // Me stays the current primary section while About is open.
    await expect(
      page.getByRole("navigation").first().getByRole("link", { name: "Me" }),
    ).toHaveAttribute("aria-current", "page");
  });
});
