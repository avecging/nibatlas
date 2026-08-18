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
  await page.getByRole("combobox", { name: /search a destination or shop/i }).fill(query);
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

test("destination search commits a viewport and lists shops", async ({ page }) => {
  await openMap(page);
  await searchDestination(page, "Ginza", /^Ginza/);

  const list = page.getByRole("list", { name: /shops in the searched area/i });
  await expect(list).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Demo Ginza Fountain Pen Salon", exact: true }),
  ).toBeVisible();
});

test("destination and shop results stay visually distinct", async ({ page }) => {
  await openMap(page);
  await page.getByRole("combobox", { name: /search a destination or shop/i }).fill("Kyoto");

  await expect(page.getByText("Destinations")).toBeVisible();
  await expect(page.getByText("Nib Atlas shops")).toBeVisible();
});

test("marker and card selection stay synchronized", async ({ page }) => {
  await openMap(page);
  await searchDestination(page, "Ginza", /^Ginza/);

  const marker = page
    .getByRole("button", { name: /^Demo Ginza Fountain Pen Salon, Chūō, Tokyo\./ })
    .first();
  await expect(marker).toBeVisible();
  await marker.click();

  const card = page.getByRole("article", { name: "Demo Ginza Fountain Pen Salon" });
  await expect(card).toHaveAttribute("data-selected", "true");
  await expect(marker).toHaveAttribute("aria-pressed", "true");

  // Selecting from the list keeps the same shared selection.
  const otherCardButton = page.getByRole("button", {
    name: "Demo Shinjuku Stationery Hall",
    exact: true,
  });
  if (await otherCardButton.isVisible().catch(() => false)) {
    await otherCardButton.click();
    await expect(card).toHaveAttribute("data-selected", "false");
  }
});

test("panning offers Search this area instead of refetching", async ({ page }) => {
  await openMap(page);
  await searchDestination(page, "Ginza", /^Ginza/);

  await expect(page.getByRole("button", { name: /search this area/i })).toHaveCount(0);

  await panMap(page, -0.55, -0.35);

  await expect(page.getByRole("button", { name: /search this area/i })).toBeVisible();
  // Movement alone must not requery: the previous results are still listed.
  await expect(
    page.getByRole("button", { name: "Demo Ginza Fountain Pen Salon", exact: true }),
  ).toBeVisible();
});

test("filters apply only when the viewport query is committed", async ({ page }) => {
  await openMap(page);
  await searchDestination(page, "Tokyo", /^Tokyo/);

  const list = page.getByRole("list", { name: /shops in the searched area/i });
  await expect(list).toBeVisible();

  await page.getByRole("button", { name: "Nib / Repair Services", exact: true }).click();
  await expect(page.getByText(/search this area to apply/i)).toBeVisible();

  await page.getByRole("button", { name: /search this area/i }).click();
  await expect(page.getByText(/search this area to apply/i)).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Demo Asakusa Nib Workshop", exact: true }),
  ).toBeVisible();
});

test("explore to simulated collection to Passport", async ({ page }) => {
  await openMap(page);
  await searchDestination(page, "Zhongshan", /Zhongshan/);

  await page
    .getByRole("article", { name: "Demo Taipei Zhongshan Pen Room" })
    .getByRole("link", { name: "Shop details" })
    .click();

  await expect(
    page.getByRole("heading", { level: 1, name: "Demo Taipei Zhongshan Pen Room" }),
  ).toBeVisible();

  await page.getByRole("button", { name: /collect stamp \(simulated\)/i }).click();
  await expect(page.getByRole("dialog", { name: /before you collect/i })).toBeVisible();
  await page.getByRole("button", { name: /simulate: i am at this shop/i }).click();

  const ceremony = page.getByRole("dialog", { name: /impression collected/i });
  await expect(ceremony).toBeVisible();
  await ceremony.getByRole("link", { name: /open in passport/i }).click();

  await expect(page.getByRole("heading", { level: 1, name: "Zhongshan, Taipei" })).toBeVisible();
  await expect(page.getByText("Demo Taipei Zhongshan Pen Room").first()).toBeVisible();
});

test("collecting twice does not create a second impression", async ({ page }) => {
  await page.goto("/shops/demo-hualien-coastline-pen-stop");

  await page.getByRole("button", { name: /collect stamp \(simulated\)/i }).click();
  await page.getByRole("button", { name: /simulate: i am at this shop/i }).click();
  await page.getByRole("button", { name: /back to shop/i }).click();

  await page.getByRole("button", { name: /view atlas stamp/i }).click();
  await page.getByRole("button", { name: /show the impression/i }).click();
  await expect(page.getByRole("dialog", { name: /already in your passport/i })).toBeVisible();
  await page.getByRole("button", { name: /back to shop/i }).click();

  await page.goto("/passport/tw/hualien");
  await expect(page.getByRole("listitem").filter({ hasText: "Demo Hualien" })).toHaveCount(1);
});

test("saving a shop is consistent across card, shop page, and Saved", async ({ page }) => {
  await page.goto("/shops/demo-nakano-pen-archive");

  const saveButton = page.getByRole("button", { name: /^save$/i });
  await saveButton.click();
  await expect(page.getByRole("button", { name: /^saved$/i })).toBeVisible();

  await page.goto("/saved");
  await expect(
    page.getByRole("article", { name: "Demo Nakano Pen Archive" }),
  ).toBeVisible();
});

test("long Japanese and Traditional Chinese names render without overflow", async ({ page }) => {
  await page.goto("/shops/demo-taipei-daan-ink-library");

  const localName = page.getByText("示範台北大安墨水圖書室與試寫空間");
  await expect(localName).toBeVisible();

  const overflowing = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  );
  expect(overflowing).toBe(false);
});
