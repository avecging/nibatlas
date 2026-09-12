import { expect, test, type Page } from "@playwright/test";

import {
  seedLegacyPrototypeSession,
  seedSampleCollection,
} from "../support/local-state";

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

/** Clicks whichever exit control is visible at this breakpoint. */
async function exitReviewerMode(page: Page) {
  const control = page.getByRole("button", { name: /exit/i }).filter({ visible: true });

  await control.first().click();
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

    await exitReviewerMode(page);
    await expectMode(page, "off");

    // The choice persists: a later visit with no parameter stays off.
    await page.goto("/me");
    await expectMode(page, "off");
  });

  test("exiting takes review out of the URL, so reloading that page stays off", async ({
    page,
  }) => {
    // Remembering the choice is not enough. An explicit parameter outranks the
    // remembered one, so leaving `?review=1` in the address bar means the very
    // next reload undoes the exit.
    await page.goto("/?destination=ginza&review=1");
    await expectMode(page, "on");

    await exitReviewerMode(page);
    await expectMode(page, "off");

    // Unrelated parameters are the user's and survive.
    expect(new URL(page.url()).searchParams.get("review")).toBeNull();
    expect(new URL(page.url()).searchParams.get("destination")).toBe("ginza");

    await page.reload();
    await expectMode(page, "off");
    await expect(reviewerBadge(page)).toHaveCount(0);

    // And so does a second reload, and a navigation away and back.
    await page.reload();
    await expectMode(page, "off");
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

    /*
     * The sign-in row's reviewer wording follows what is actually missing.
     * Authentication exists from Milestone 4 WP3 on, so the label no longer
     * names that milestone: this build has no Supabase project configured for
     * it, and WP6 is what configures one.
     */
    await expect(page.getByText(/hosted sign-in is WP6/i)).toBeVisible();
    // The prototype-controls note names the storage, and has to be right about
    // it: the store is mode-namespaced local storage, not a session.
    await expect(page.getByText(/on this device only/i)).toBeVisible();
    await expect(page.getByText(/local storage under a reviewer-only key/i)).toBeVisible();
    await expect(page.getByText(/browser session/i)).toHaveCount(0);
    await expect(
      page.getByText(/Counted against curated set [a-z]{2}-/i).first(),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: /reset the prototype/i })).toBeVisible();
  });

  /*
   * WP2 removes Me's standing Location section, which the approved structure
   * does not carry. The reviewer note about geolocation belongs at the moment
   * the position would be requested, and that is where it is now asserted.
   */
  test("the location reviewer note lives at the point of request", async ({ page }) => {
    await page.goto("/shops/juspirit-banqiao?review=1");
    await expectMode(page, "on");

    await page.getByRole("button", { name: /collect stamp/i }).click();

    await expect(
      page.getByText(/this build never calls the Geolocation API/i),
    ).toBeVisible();
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
    await expect(
      page.getByTestId("reviewer-note").getByText(/on this device only/i),
    ).toBeVisible();
    await expect(page.getByText(/browser session/i)).toHaveCount(0);
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
    await expect(page.getByText(/after you choose the location check/i)).toBeVisible();
    await expect(page.getByText(/Standalone previews may show impressions/i)).toContainText(
      /do not verify your location/i,
    );
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

/**
 * A clean device holds nothing.
 *
 * Milestone 1 opened every device on the seeded demonstration collection: six
 * stamps across three countries and two saved shops. On a tester's screen Me and
 * Passport present that as their own history, which reads as though something
 * had been following them around. Normal mode now starts empty; the seed is a
 * reviewer facility.
 */
test.describe("a clean normal-mode device starts empty", () => {
  test("Me shows no geography at all", async ({ page }) => {
    await page.goto("/me");
    await expectMode(page, "off");

    // WP2 omits Places visited outright rather than rendering it as three
    // zeroes: a section that exists only to report nothing is the acceptance
    // checklist answering itself.
    await expect(page.getByRole("region", { name: /places visited/i })).toHaveCount(0);

    // No invented geography anywhere on the page.
    const text = await visibleText(page);
    for (const locality of ["Chūō, Tokyo", "Naka, Yokohama", "East District, Tainan"]) {
      expect(text, `Me names ${locality} on a clean device`).not.toContain(locality);
    }
  });

  test("Passport is empty and says how to fill it", async ({ page }) => {
    await page.goto("/passport");
    await expectMode(page, "off");

    const text = await visibleText(page);

    for (const shop of ["Ginza Itoya", "Aesthetic Bay", "Fook Hing"]) {
      expect(text, `Passport shows a collected ${shop} on a clean device`).not.toContain(
        shop,
      );
    }
  });

  test("Saved mode holds nothing", async ({ page }) => {
    await page.goto("/saved");
    await expectMode(page, "off");

    await expect(page.getByRole("link", { name: /^Saved \(0\)/ })).toBeVisible();
    await expect(page.getByRole("article", { name: "TY Lee Pen Shop" })).toHaveCount(0);
  });

  test("reviewer mode keeps the seeded demonstration collection", async ({ page }) => {
    await page.goto("/me?review=1");
    await expectMode(page, "on");

    const visited = page.getByRole("region", { name: /places visited/i });

    await expect(
      visited.locator("p", { has: page.getByText("Countries", { exact: true }) }),
    ).toContainText("3");
    await expect(visited.getByText(/Chūō, Tokyo/)).toBeVisible();
  });

  test("switching modes never overwrites a tester's own local state", async ({ page }) => {
    await page.goto("/shops/juspirit-banqiao");
    await expectMode(page, "off");

    // A real save, made by the person using the device.
    await page.getByRole("button", { name: "Save shop" }).click();
    await expect(page.getByRole("button", { name: "Remove saved shop" })).toBeVisible();

    // Into reviewer mode: the demonstration collection appears, and it is not
    // theirs — this shop is not saved in it.
    await page.goto("/shops/juspirit-banqiao?review=1");
    await expectMode(page, "on");
    await expect(page.getByRole("button", { name: "Save shop" })).toBeVisible();

    // Back out, and their save is exactly where they left it.
    await exitReviewerMode(page);
    await expectMode(page, "off");
    await expect(page.getByRole("button", { name: "Remove saved shop" })).toBeVisible();
    await expect(page.getByRole("link", { name: /^Saved \(1\)/ })).toHaveCount(0);

    await page.goto("/saved");
    await expect(page.getByRole("article", { name: "Juspirit" })).toBeVisible();
    await expect(page.getByRole("article", { name: "TY Lee Pen Shop" })).toHaveCount(0);
  });

  test("a Milestone 1 staging session cannot keep posing as personal history", async ({
    page,
  }) => {
    // The old single session key held seeded state on every device that opened
    // staging before this change.
    await seedLegacyPrototypeSession(page);
    await page.goto("/me");
    await expectMode(page, "off");

    await expect(page.getByRole("region", { name: /places visited/i })).toHaveCount(0);

    // It is not discarded, though: it was reviewer state, so that is where it
    // now lives.
    await page.goto("/me?review=1");
    await expectMode(page, "on");
    await expect(
      page
        .getByRole("region", { name: /places visited/i })
        .locator("p", { has: page.getByText("Countries", { exact: true }) }),
    ).toContainText("3");
  });
});

/** The truthfulness fixes from the first Codex review. */
test.describe("copy that has to be true of every record", () => {
  test("About does not certify every entry as a walk-in shop", async ({ page }) => {
    await page.goto("/about");
    await expectMode(page, "off");

    const text = await visibleText(page);

    // SKB's own source does not confirm a public shopfront, so no blanket claim.
    expect(text).not.toMatch(/every shop in nib atlas is a real place someone can walk/i);
    expect(text).toMatch(/most are shops you can walk into/i);
    expect(text).toMatch(/do not confirm a public shopfront/i);
  });

  test("the unconfirmed record says so on its own page", async ({ page }) => {
    await page.goto("/shops/skb-kaohsiung");
    await expectMode(page, "off");

    await expect(page.getByText(/does not confirm a retail shopfront/i)).toBeVisible();
  });

  test("a mixed-source record credits every source kind it rests on", async ({ page }) => {
    // TY Lee's own website confirms only its local-script name; the name,
    // address and district come from a community list. Both were read on the
    // same day, so the plain "checked" wording is accurate here.
    await page.goto("/shops/ty-lee-pen-shop");
    await expectMode(page, "off");

    await expect(
      page.getByText(
        /Details from the shop's own website and a community shop list, checked \d+ \w+ \d{4}\./,
      ),
    ).toBeVisible();
  });

  test("a record whose sources were read on different days says so", async ({ page }) => {
    // SKB's website was read in August; the visit note is from March. Printing
    // "checked 16 March 2026" would state something untrue about the website, so
    // the clause names the date as a floor instead.
    await page.goto("/shops/skb-kaohsiung");
    await expectMode(page, "off");

    await expect(
      page.getByText(
        "Details from the shop's own website and a Nib Atlas visit; oldest source checked 16 March 2026.",
      ),
    ).toBeVisible();

    // And it never claims the newer date for the whole record.
    expect(await visibleText(page)).not.toContain("checked 26 August 2026");
  });

  test("a link preview never advertises a field the page omits", async ({ page }) => {
    // NAGASAWA PenStyle DEN publishes neither an address nor hours.
    await page.goto("/shops/nagasawa-penstyle-den");

    const description = await page
      .locator('head meta[name="description"]')
      .getAttribute("content");

    expect(description).toBeTruthy();
    expect(description?.toLowerCase()).not.toContain("address");
    expect(description?.toLowerCase()).not.toContain("hour");
  });

  test("Privacy distinguishes account records from standalone local storage", async ({
    page,
  }) => {
    await page.goto("/privacy");
    await expectMode(page, "off");

    const text = await visibleText(page);
    expect(text).toMatch(/Account-backed saving and verified stamp collection require sign-in/i);
    expect(text).toMatch(/appear when you sign in on another device/i);
    expect(text).toMatch(/standalone demonstration without sign-in configured, saves and preview impressions instead stay in this browser and do not require an account/i);
    expect(text).toMatch(/preview impressions are never imported as visits/i);

    await page.goto("/me");
    const device = page.getByRole("region", { name: /on this device/i });

    await expect(device).toContainText(/stored in this browser, on this device/i);
    await expect(device).toContainText(/do not sync/i);
  });

  /*
   * The two controls act on saved shops and collected impressions. Privacy may
   * describe exactly that and no more: not preferences, which neither control
   * touches, and not a promise that the device is left clean.
   */
  test("Privacy describes the local-data controls without overstating them", async ({
    page,
  }) => {
    await page.goto("/privacy");
    await expectMode(page, "off");

    const text = await visibleText(page);

    expect(text).toMatch(
      /Clear data on this device\s+removes those same two things\s+from this browser/i,
    );
    expect(text).not.toMatch(/home screen/i);
    expect(text).not.toMatch(/removes everything Nib Atlas has stored/i);

    await expect(
      page.getByRole("link", { name: /Me\s*›?\s*On this device/i }),
    ).toHaveAttribute("href", "/me#me-device");
  });
});

/** The populated journeys still work when the state is genuinely the user's. */
test.describe("an arranged collection behaves as before", () => {
  test("Passport and Me read a seeded normal-mode collection", async ({ page }) => {
    await seedSampleCollection(page);
    await page.goto("/me");
    await expectMode(page, "off");

    await expect(
      page
        .getByRole("region", { name: /places visited/i })
        .locator("p", { has: page.getByText("Countries", { exact: true }) }),
    ).toContainText("3");
  });
});
