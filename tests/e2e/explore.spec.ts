import { expect, test, type Page } from "@playwright/test";

async function openMap(page: Page) {
  await page.goto("/");
  await expect(page.getByTestId("map-canvas")).toBeVisible();

  const dismiss = page.getByRole("button", { name: "Dismiss introduction" });
  if (await dismiss.isVisible().catch(() => false)) {
    await dismiss.click();
  }
}

/** The map is settled when the committed query has landed and nothing has moved. */
async function expectSettled(page: Page) {
  await expect(page.getByTestId("explore")).toHaveAttribute("data-search-offer", "hidden");
}

async function searchDestination(page: Page, query: string, optionName: RegExp) {
  await page.getByRole("combobox", { name: /search shops or places/i }).fill(query);
  await page.getByRole("option", { name: optionName }).first().click();

  // The destination commits only once the camera has arrived, so wait for the
  // committed label before asserting anything about the new result set.
  await expect(page.getByTestId("explore")).toHaveAttribute(
    "data-committed-label",
    optionName,
  );
  await expect(page.getByRole("list", { name: /shops in the searched area/i })).toBeVisible();
  await expectSettled(page);
}

/**
 * Below the desktop split the results live in a sheet that starts at Peek, which
 * deliberately shows only the count and the first card. Anything further down
 * needs the sheet raised first — exactly as a person would.
 */
async function raiseSheet(page: Page) {
  const handle = page.getByRole("button", { name: /results sheet/i });

  if (!(await handle.isVisible().catch(() => false))) {
    return;
  }

  await handle.click();
  await expect(page.getByTestId("results-sheet")).toHaveAttribute("data-state", "half");
}

/** A stepwise drag so MapLibre sees a real gesture rather than one jump. */
async function panMap(page: Page, fractionX: number, fractionY: number) {
  const box = await page.getByTestId("map-canvas").boundingBox();
  expect(box).not.toBeNull();

  const startX = box!.x + box!.width * 0.75;
  const startY = box!.y + box!.height * 0.55;
  const dx = box!.width * fractionX;
  const dy = box!.height * fractionY;

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  for (let step = 1; step <= 20; step += 1) {
    await page.mouse.move(startX + (dx * step) / 20, startY + (dy * step) / 20);
  }
  await page.mouse.up();
}

test("first visit explains the product and never asks for an account", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByText("Find fountain pen shops. Visit them. Collect stamps."),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /sign in|log in/i })).toHaveCount(0);
});

test("primary navigation is exactly Map, Passport, and Me", async ({ page }) => {
  await page.goto("/");

  const nav = page.getByRole("navigation", { name: /^primary$/i }).or(
    page.getByRole("navigation", { name: /primary sections/i }),
  );
  const labels = await nav.first().getByRole("link").allInnerTexts();

  expect(labels.map((label) => label.trim())).toEqual(["Map", "Passport", "Me"]);
  await expect(nav.first().getByRole("link", { name: /discover/i })).toHaveCount(0);
  await expect(nav.first().getByRole("link", { name: /^saved/i })).toHaveCount(0);
});

test("Discover is not a destination", async ({ page }) => {
  const response = await page.goto("/discover");

  expect(response?.status()).toBe(404);
});

test("place search commits a viewport and lists shops", async ({ page }) => {
  await openMap(page);
  await searchDestination(page, "Ginza", /^Ginza/);

  const list = page.getByRole("list", { name: /shops in the searched area/i });
  await expect(list).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Ginza Itoya Main Store", exact: true }),
  ).toBeVisible();
});

test("place and shop results stay visually distinct", async ({ page }) => {
  await openMap(page);
  await page
    .getByRole("combobox", { name: /search shops or places/i })
    .fill("Kaohsiung");

  await expect(page.getByText("Places", { exact: true })).toBeVisible();
  await expect(page.getByText("Shops", { exact: true })).toBeVisible();

  // A place option moves the camera; a shop option selects a marker. They are
  // separately labelled, not merged into one ranked list.
  await expect(page.getByRole("option").filter({ hasText: /Place · / })).not.toHaveCount(
    0,
  );
  await expect(
    page.getByRole("option").filter({ hasText: /Shop in the Nib Atlas catalogue/ }),
  ).not.toHaveCount(0);
});

test("choosing a shop from search selects its marker and card", async ({ page }) => {
  await openMap(page);
  await page
    .getByRole("combobox", { name: /search shops or places/i })
    .fill("Pen House");
  await page
    .getByRole("option")
    .filter({ hasText: /Shop in the Nib Atlas catalogue/ })
    .first()
    .click();

  await expect(page.getByRole("article", { name: "Pen House" })).toHaveAttribute(
    "data-selected",
    "true",
  );
});

test("marker and card selection stay synchronized", async ({ page }) => {
  await openMap(page);
  await searchDestination(page, "Ginza", /^Ginza/);

  const marker = page
    .getByRole("button", { name: /^Ginza Itoya Main Store, Chūō, Tokyo\./ })
    .first();
  await expect(marker).toBeVisible();
  await marker.click();

  const card = page.getByRole("article", { name: "Ginza Itoya Main Store" });
  await expect(card).toHaveAttribute("data-selected", "true");
  await expect(marker).toHaveAttribute("aria-pressed", "true");
});

test("panning offers Search this area instead of refetching", async ({ page }) => {
  await openMap(page);
  await searchDestination(page, "Ginza", /^Ginza/);

  await expect(page.getByRole("button", { name: /search this area/i })).toHaveCount(0);

  await panMap(page, -0.55, -0.35);

  await expect(page.getByRole("button", { name: /search this area/i })).toBeVisible();
  // Movement alone must not requery: the previous results are still listed.
  await expect(
    page.getByRole("button", { name: "Ginza Itoya Main Store", exact: true }),
  ).toBeVisible();
});

test("selecting a card never looks like the user moved the map", async ({ page }) => {
  await openMap(page);
  await searchDestination(page, "Tokyo", /^Tokyo/);

  const explore = page.getByTestId("explore");
  await expect(explore).toHaveAttribute("data-search-offer", "hidden");

  // Selection can pan the map to reveal a marker. That is an application move,
  // so it must not offer a new search.
  const cards = page.getByRole("article");
  const count = await cards.count();

  for (let index = 0; index < Math.min(count, 5); index += 1) {
    await cards.nth(index).getByRole("button").first().click();
    await expect(explore).toHaveAttribute("data-search-offer", "hidden");
  }
});

test("resizing the window neither invents nor erases Search this area", async ({ page }) => {
  await openMap(page);
  await searchDestination(page, "Tokyo", /^Tokyo/);

  const explore = page.getByTestId("explore");
  const viewport = page.viewportSize();
  expect(viewport).not.toBeNull();

  // Settled: a resize must not invent movement.
  await page.setViewportSize({ width: viewport!.width, height: viewport!.height - 80 });
  await expect(explore).toHaveAttribute("data-search-offer", "hidden");
  await expect(explore).toHaveAttribute("data-committed-label", /Tokyo/);

  // Moved but not committed: a resize must not swallow the prompt.
  await panMap(page, -0.5, -0.3);
  await expect(explore).toHaveAttribute("data-search-offer", "offer");

  await page.setViewportSize({ width: viewport!.width, height: viewport!.height });
  await expect(explore).toHaveAttribute("data-search-offer", "offer");
  await expect(explore).toHaveAttribute("data-committed-label", /Tokyo/);
});

test("a gesture during a destination fly leaves the user in control", async ({ page }) => {
  await openMap(page);

  await page.getByRole("combobox", { name: /search shops or places/i }).fill("Kobe");
  await page.getByRole("option", { name: /^Kobe/ }).first().click();

  // Interrupt the fly. Whether or not it had already landed, the user must end
  // up somewhere they can search, never with a queued commit applied to a
  // viewport they did not choose.
  await panMap(page, -0.5, -0.35);

  const explore = page.getByTestId("explore");
  await expect(explore).toHaveAttribute("data-search-offer", "offer");
  await expect(explore).toHaveAttribute("data-explore-status", "idle");

  await page.getByRole("button", { name: /search this area/i }).click();
  await expect(explore).toHaveAttribute("data-search-offer", "hidden");
});

test("filters apply only when the viewport query is committed", async ({ page }) => {
  await openMap(page);
  await searchDestination(page, "Tokyo", /^Tokyo/);

  const list = page.getByRole("list", { name: /shops in the searched area/i });
  await expect(list).toBeVisible();

  await raiseSheet(page);
  await page.getByRole("button", { name: "Vintage / Used", exact: true }).click();
  await expect(page.getByText(/search this area to apply/i)).toBeVisible();
  // Uncommitted: the existing results are untouched.
  await expect(
    page.getByRole("button", { name: "Ginza Itoya Main Store", exact: true }),
  ).toBeVisible();

  await page.getByRole("button", { name: /search this area/i }).click();
  await expect(page.getByText(/search this area to apply/i)).toHaveCount(0);
  // No shop in the sourced subset is a vintage dealer, so the honest result is
  // an empty set plus a way to recover.
  await expect(page.getByText(/no shops match this area/i)).toBeVisible();
});

test("global Saved mode reaches shops outside the current viewport", async ({ page }) => {
  await openMap(page);
  // Commit a viewport over Tainan, which holds neither seeded saved shop.
  await searchDestination(page, "Tainan", /^Tainan/);

  await page.getByRole("link", { name: /^Saved \(/ }).click();

  await expect(page.getByTestId("explore")).toHaveAttribute("data-explore-mode", "saved");
  await raiseSheet(page);
  await expect(page.getByText(/Saved — all locations/i)).toBeVisible();

  // Kobe and Taipei are both far outside the committed Tainan viewport.
  await expect(page.getByRole("article", { name: "NAGASAWA PenStyle DEN" })).toBeVisible();
  await expect(page.getByRole("article", { name: "TY Lee Pen Shop" })).toBeVisible();
  // Grouped by country so geography stays legible.
  await expect(page.getByRole("heading", { name: "Japan" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Taiwan" })).toBeVisible();
});

test("a saved shop returns to the map with that shop selected", async ({ page }) => {
  await page.goto("/saved");
  await raiseSheet(page);

  await page
    .getByRole("article", { name: "TY Lee Pen Shop" })
    .getByRole("link", { name: "Shop details" })
    .click();

  await expect(page.getByRole("heading", { level: 1, name: "TY Lee Pen Shop" })).toBeVisible();
  await page.getByRole("link", { name: /back to saved shops/i }).click();
  await expect(page.getByTestId("explore")).toHaveAttribute("data-explore-mode", "saved");
});

test("explore to simulated collection to Passport", async ({ page }) => {
  await openMap(page);
  await searchDestination(page, "Tainan", /^Tainan/);

  await raiseSheet(page);
  await page
    .getByRole("article", { name: "Pen House" })
    .getByRole("link", { name: "Shop details" })
    .click();

  await expect(page.getByRole("heading", { level: 1, name: "Pen House" })).toBeVisible();

  await page.getByRole("button", { name: /view atlas stamp/i }).click();
  await expect(page.getByRole("dialog", { name: /already have this stamp/i })).toBeVisible();
  await page.getByRole("button", { name: /show the impression/i }).click();

  const ceremony = page.getByRole("dialog", { name: /already in your passport/i });
  await expect(ceremony).toBeVisible();
  await ceremony.getByRole("link", { name: /open in passport/i }).click();

  // The ceremony opens the Passport at the impression that was just pressed, so
  // it lands on that locality's own page already open — not on the cover.
  await expect(page).toHaveURL(/\/passport\/tw\/east-tainan$/);
  await expect(
    page.getByRole("heading", { level: 3, name: /East District, Tainan/ }).first(),
  ).toBeVisible();
});

test("collecting once updates Visited everywhere, and only once", async ({ page }) => {
  await page.goto("/shops/juspirit-banqiao");

  await page.getByRole("button", { name: /collect stamp \(simulated\)/i }).click();
  await page.getByRole("button", { name: /simulate: i am at this shop/i }).click();
  await expect(page.getByRole("dialog", { name: /impression collected/i })).toBeVisible();
  await page.getByRole("button", { name: /back to shop/i }).click();

  // Shop page.
  await expect(page.getByText(/Visited/).first()).toBeVisible();

  // Collecting again is idempotent.
  await page.getByRole("button", { name: /view atlas stamp/i }).click();
  await page.getByRole("button", { name: /show the impression/i }).click();
  await expect(page.getByRole("dialog", { name: /already in your passport/i })).toBeVisible();
  await page.getByRole("button", { name: /back to shop/i }).click();

  // Map card.
  await page.goto("/?shop=juspirit-banqiao");
  await raiseSheet(page);
  const card = page.getByRole("article", { name: "Juspirit" });
  await expect(card.getByText("Visited")).toBeVisible();

  // Me counts it exactly once.
  await page.goto("/me");
  await expect(page.getByText("Banqiao, New Taipei")).toHaveCount(1);
});

test("saving a shop is consistent across card, shop page, and Saved mode", async ({
  page,
}) => {
  await page.goto("/shops/nagasawa-stationery-center-main-store");

  const saveButton = page.getByRole("button", { name: /^save$/i });
  await saveButton.click();
  await expect(page.getByRole("button", { name: /^saved$/i })).toBeVisible();

  await page.goto("/saved");
  await raiseSheet(page);
  await expect(
    page.getByRole("article", { name: "NAGASAWA Stationery Center Main Store" }),
  ).toBeVisible();
});

test("long Japanese and Traditional Chinese names render without overflow", async ({
  page,
}) => {
  await page.goto("/shops/ginza-itoya-yokohama-motomachi");
  await expect(page.getByText("銀座 伊東屋 横浜元町")).toBeVisible();

  await page.goto("/shops/pen-house-tainan");
  await expect(page.getByText("文寶房名品")).toBeVisible();

  const overflowing = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  );
  expect(overflowing).toBe(false);
});

test("a shop with no published hours shows none, and says so", async ({ page }) => {
  await page.goto("/shops/skb-kaohsiung");

  await expect(page.getByText(/No opening hours are published/i)).toBeVisible();
  // No invented address, and no empty placeholder pretending to be one.
  await expect(page.getByText("Address", { exact: true })).toHaveCount(0);
  await expect(page.getByText(/Approximate, locality only/i)).toBeVisible();
});

test("every shop page says where its facts came from", async ({ page }) => {
  await page.goto("/shops/ginza-itoya-main-store");

  const provenance = page.getByRole("region", { name: /where this came from/i }).or(
    page.locator("section", { has: page.getByRole("heading", { name: /where this came from/i }) }),
  );

  await expect(provenance.first()).toContainText("ito-ya.co.jp");
  await expect(provenance.first()).toContainText(/confirms/i);
  await expect(page.getByText(/not a complete or\s+continuously verified catalogue/i)).toBeVisible();
});
