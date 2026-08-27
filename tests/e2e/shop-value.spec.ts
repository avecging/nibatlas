import { expect, test } from "@playwright/test";

import { useNormalMode } from "../support/local-state";

/**
 * WP4: the shop page answers whether a place is worth a pen enthusiast's trip.
 *
 * The order the question is answered in is the feature, so most of this is about
 * sequence and about what the page refuses to say. The populated value layer is
 * reviewed on `/styleguide`, from a specimen record: no source in the prototype
 * catalogue publishes a service, an in-store experience or a shop-only item, and
 * accepted decision 4 forbids inventing them.
 */
test.beforeEach(async ({ page }) => {
  await useNormalMode(page);
});

/** Visible section headings, in document order. */
async function headings(page: import("@playwright/test").Page) {
  return page
    .locator("h1, h2")
    .evaluateAll((nodes) => nodes.map((node) => node.textContent?.trim() ?? ""));
}

test("the page leads with identity and what you can do, not with a directory row", async ({
  page,
}) => {
  await page.goto("/shops/ginza-itoya-main-store");

  const order = await headings(page);

  expect(order[0]).toBe("Ginza Itoya Main Store");
  // What you can do there comes before the practical detail, whether it is the
  // sourced list or the one caution standing in for it.
  expect(order.indexOf("What you can do there")).toBeLessThan(order.indexOf("Opening hours"));

  // The shop's own name, in its own script, directly under the identity plate.
  await expect(page.getByText("銀座 伊東屋 本店")).toBeVisible();

  // One restrained photography state, and nothing pretending to be an image.
  await expect(page.getByText("Photos coming soon")).toHaveCount(1);
  await expect(page.locator("img")).toHaveCount(0);
});

test("a material information gap gets one caution and an invitation", async ({ page }) => {
  await page.goto("/shops/juspirit-banqiao");

  const gap = page.getByTestId("shop-value-gap");

  await expect(gap).toContainText(/have not confirmed what you can do at this shop/i);
  await expect(
    gap.getByRole("link", { name: "Know this shop? Help us improve this listing." }),
  ).toHaveAttribute("href", "mailto:hello@nibatlas.com?subject=%5BShop%20correction%5D%20Juspirit");

  // Ordinary unsupported fields stay silent: no station, payment or language row
  // invented to fill the section out.
  await expect(page.getByText("Nearest station")).toHaveCount(0);
  await expect(page.getByText("Payment", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Languages", { exact: true })).toHaveCount(0);
});

test("every shop page routes a correction, naming the shop", async ({ page }) => {
  await page.goto("/shops/ty-lee-pen-shop");

  await expect(page.getByText(/Found something wrong with this listing\?/)).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Report incorrect information" }),
  ).toHaveAttribute(
    "href",
    "mailto:hello@nibatlas.com?subject=%5BShop%20correction%5D%20TY%20Lee%20Pen%20Shop",
  );
});

test("nearby pen shops are trip context, and are honest about distance", async ({
  page,
}) => {
  // Two Singapore shops, both placed from a sourced street address.
  await page.goto("/shops/aesthetic-bay");

  const nearby = page.getByRole("region", { name: "Nearby pen shops" });

  // Trip context sits last on the page, after the actions.
  expect((await headings(page)).at(-1)).toBe("Nearby pen shops");
  await expect(nearby.getByText(/about \d+ m away/)).toBeVisible();
  await expect(nearby.getByText(/straight-line between approximate map points/i)).toBeVisible();

  await nearby.getByRole("link", { name: /Fook Hing Trading Co\./ }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Fook Hing Trading Co." })).toBeVisible();

  // Two Kobe shops, both placed from the locality only: no number is claimed.
  await page.goto("/shops/nagasawa-stationery-center-main-store");

  const kobe = page.getByRole("region", { name: "Nearby pen shops" });

  await expect(kobe.getByText("Also in Kobe")).toBeVisible();
  await expect(kobe.getByText(/away/)).toHaveCount(0);

  // A shop with no catalogue neighbour in reach gets no section at all.
  await page.goto("/shops/skb-kaohsiung");
  await expect(page.getByRole("heading", { name: "Nearby pen shops" })).toHaveCount(0);
});

test("Directions hand off to the platform's own maps application", async ({ page }) => {
  await page.goto("/shops/ginza-itoya-main-store");

  const directions = page.getByRole("link", { name: /directions/i });
  const android = await page.evaluate(() =>
    /android/i.test(window.navigator.userAgent),
  );

  /*
   * The href is resolved from the platform, so the expectation follows the
   * project's own device rather than assuming a desktop browser.
   *
   * Asserted with `toHaveAttribute` rather than a bare read: the server renders
   * the universal fallback and hydration upgrades it, so a single read can catch
   * the pre-hydration value. This retries until the upgraded href is in place.
   */
  await expect(directions).toHaveAttribute(
    "href",
    android
      ? /^geo:35\.6721,139\.7669\?q=/
      : "https://www.openstreetmap.org/directions?to=35.6721%2C139.7669",
  );

  const href = await directions.getAttribute("href");

  // Only the destination travels. Nothing sends a user position.
  expect(href).not.toMatch(/saddr|from=|origin/);

  // No embedded itinerary, map frame, or route planner on the page.
  await expect(page.locator("iframe")).toHaveCount(0);
});

test("the populated value layer is reviewable from a labelled specimen", async ({
  page,
}) => {
  await page.goto("/styleguide");

  const specimen = page.getByText(/Specimen — an invented record for component review/);

  await expect(specimen).toBeVisible();

  const services = page.getByRole("list", { name: "Services" });

  await expect(services.getByText("Nib alignment & tuning")).toBeVisible();
  await expect(services.getByText("Walk-in · ~30 min")).toBeVisible();
  await expect(services.getByText("Booking · 3–5 days")).toBeVisible();
  await expect(
    page.getByRole("list", { name: "In-store experiences" }).getByText("Test bench"),
  ).toBeVisible();
  await expect(
    page.getByRole("list", { name: "Only available here" }).getByText("House ink — Bench No.4"),
  ).toBeVisible();
});

test("no shop page becomes a listing, a catalogue, or a review page", async ({ page }) => {
  for (const slug of ["ginza-itoya-main-store", "pen-house-tainan", "skb-kaohsiung"]) {
    await page.goto(`/shops/${slug}`);

    const body = (await page.locator("main").innerText()).replace(/\s+/g, " ");

    expect(body).not.toMatch(/\brating\b|\breviews?\b|in stock|add to (bag|cart)|buy now/i);
  }
});
