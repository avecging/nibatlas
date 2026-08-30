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
    .locator("h1, h2, h3, h4")
    .evaluateAll((nodes) => nodes.map((node) => node.textContent?.trim() ?? ""));
}

test("the page leads with identity, the actions, and what you can do", async ({
  page,
}) => {
  await page.goto("/shops/ginza-itoya-main-store");

  const order = await headings(page);

  expect(order[0]).toBe("Ginza Itoya Main Store");
  // What you can do there comes before the practical detail, whether it is the
  // sourced list or the one caution standing in for it.
  expect(order.indexOf("What you can do there")).toBeLessThan(
    order.indexOf("Plan your visit"),
  );

  // The founder's staging review put the actions back at the top, with Save as a
  // bookmark beside the name rather than a button competing with Collect Stamp.
  const save = page.getByRole("button", { name: "Save shop" });
  const collect = page.getByRole("button", { name: /^collect stamp$/i });

  await expect(save).toBeVisible();
  await expect(collect).toBeVisible();

  const actionsAboveSections = await page.evaluate(() => {
    const button = document.querySelector('button[aria-label="Save shop"]');
    const heading = [...document.querySelectorAll("h2")].find(
      (node) => node.textContent?.trim() === "Plan your visit",
    );

    return (
      (button?.getBoundingClientRect().top ?? 0) <
      (heading?.getBoundingClientRect().top ?? 0)
    );
  });

  expect(actionsAboveSections).toBe(true);

  // The shop's own name, in its own script, directly under the identity plate.
  await expect(page.getByText("銀座 伊東屋 本店")).toBeVisible();

  // One restrained photography state, and nothing pretending to be an image.
  await expect(page.getByText("Photos coming soon")).toHaveCount(1);
  await expect(page.locator("img")).toHaveCount(0);
});

test("Save is a bookmark whose name and state change together", async ({ page }) => {
  await page.goto("/shops/pen-house-tainan");

  const save = page.getByRole("button", { name: "Save shop" });

  await expect(save).toHaveAttribute("aria-pressed", "false");

  // A real 44 px target, not an icon squeezed by its flex parent.
  const box = await save.boundingBox();

  expect(box?.width ?? 0).toBeGreaterThanOrEqual(44);
  expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);

  await save.click();

  const saved = page.getByRole("button", { name: "Remove saved shop" });

  await expect(saved).toBeVisible();
  await expect(saved).toHaveAttribute("aria-pressed", "true");

  await saved.click();
  await expect(page.getByRole("button", { name: "Save shop" })).toBeVisible();
});

test("the official website appears once, as visit information", async ({ page }) => {
  await page.goto("/shops/ginza-itoya-main-store");

  // The header button is gone; the sourced link lives in Before you go.
  await expect(page.getByRole("link", { name: /^official site$/i })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "ito-ya.co.jp" })).toHaveCount(1);
  await expect(page.getByText("Official website")).toBeVisible();
});

test("Plan your visit renders no heading over an empty subsection", async ({
  page,
}) => {
  // SKB has a link and unpublished hours, and no address, station, floor note or
  // catalogue neighbour in reach.
  await page.goto("/shops/skb-kaohsiung");

  await expect(page.getByRole("heading", { name: "Plan your visit" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Before you go" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Getting there" })).toHaveCount(0);

  // Nothing reserved for what is absent: every heading on the page has content
  // under it before the next heading starts.
  const emptyHeadings = await page.evaluate(() =>
    [...document.querySelectorAll("h2, h3")].filter((heading) => {
      const next = heading.nextElementSibling;

      return next === null || /^H[23]$/.test(next.tagName);
    }).length,
  );

  expect(emptyHeadings).toBe(0);
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

  const nearby = page.getByRole("list", { name: "Nearby pen shops" });

  // Trip context sits inside Getting there, not in a section of its own.
  const order = await headings(page);

  expect(order.slice(order.indexOf("Plan your visit"), order.indexOf("Plan your visit") + 4)).toEqual([
    "Plan your visit",
    "Getting there",
    "Nearby pen shops",
    "Before you go",
  ]);
  await expect(nearby.getByText(/Approx\. \d+ m away/)).toBeVisible();

  // No separate straight-line disclaimer under the list.
  await expect(page.getByText(/straight-line/i)).toHaveCount(0);
  await expect(page.getByText(/approximate map points/i)).toHaveCount(0);

  await nearby.getByRole("link", { name: /Fook Hing Trading Co\./ }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Fook Hing Trading Co." })).toBeVisible();

  // Two Kobe shops, both placed from the locality only: no number is claimed.
  await page.goto("/shops/nagasawa-stationery-center-main-store");

  const kobe = page.getByRole("list", { name: "Nearby pen shops" });

  await expect(kobe.getByText("Also in Kobe")).toBeVisible();
  await expect(kobe.getByText(/away/)).toHaveCount(0);

  // A shop with no catalogue neighbour in reach gets no section at all.
  await page.goto("/shops/skb-kaohsiung");
  await expect(page.getByRole("heading", { name: "Nearby pen shops" })).toHaveCount(0);
});

test("the reviewer coordinate note survives a shop with no Getting there", async ({
  page,
}) => {
  // SKB has no sourced address, so *Getting there* does not render at all. The
  // coordinate note is sourcing evidence and must not disappear with it.
  await page.goto("/shops/skb-kaohsiung?review=1");

  await expect(page.getByRole("heading", { name: "Getting there" })).toHaveCount(0);
  await expect(page.getByText(/Map position/)).toBeVisible();
  await expect(page.getByText(/Approximate, locality only/i)).toBeVisible();

  // And it stays reviewer-only.
  await page.goto("/shops/skb-kaohsiung");
  await expect(page.getByText(/Map position/)).toHaveCount(0);
});

test("an unconfirmed operational status is a visible caution", async ({ page }) => {
  await page.goto("/shops/skb-kaohsiung");

  const badge = page.getByText("Status not confirmed");

  await expect(badge).toBeVisible();

  // Amber ground and an alert icon, not the neutral treatment it had on staging,
  // and never the visited or collection colours.
  const style = await badge.evaluate((node) => {
    const badgeEl = node.closest("span") ?? node;
    const computed = window.getComputedStyle(badgeEl);

    return {
      background: computed.backgroundColor,
      border: computed.borderTopColor,
      icons: badgeEl.querySelectorAll("svg").length,
    };
  });

  expect(style.background).toBe("rgb(247, 235, 215)");
  expect(style.border).toBe("rgb(154, 101, 29)");
  expect(style.icons).toBeGreaterThan(0);
});

test("Collect Stamp is Plum before collection and steps back after it", async ({
  page,
}) => {
  await page.goto("/shops/ty-lee-pen-shop");

  const collect = page.getByRole("button", { name: /^collect stamp$/i });

  await expect(collect).toHaveCSS("background-color", "rgb(107, 63, 99)");

  await collect.click();
  await page.getByRole("button", { name: /^i am at this shop$/i }).click();
  await expect(page.getByRole("dialog", { name: /impression collected/i })).toBeVisible();
  await page.keyboard.press("Escape");

  // Once collected it opens something the reader has, so it takes the restrained
  // Vermilion visited surface rather than the Plum invitation.
  const view = page.getByRole("button", { name: /view atlas stamp/i });

  await expect(view).toBeVisible();
  await expect(view).toHaveCSS("background-color", "rgb(243, 222, 212)");
  await expect(page.getByText(/This impression is in your Passport/)).toBeVisible();
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
