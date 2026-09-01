import { expect, test, type Page, type Route } from "@playwright/test";

/**
 * The contribution routes.
 *
 * The intake itself is a Google Apps Script behind a Worker secret, so these
 * journeys stub `POST /api/contribute` at the network boundary rather than
 * pretending to have one. What is under test is everything this repository owns:
 * that the routes exist and are reachable from where a person would look, that
 * the correction carries its listing without asking, that a failure says so and
 * keeps what was typed, and that a success is only ever shown when the route
 * actually answered one.
 *
 * The route handler's own behaviour — validation, the shared secret, Turnstile,
 * failing closed — is covered in `app/api/contribute/route.test.ts`, where the
 * upstream can be interrogated properly.
 */

async function intake(page: Page, handler: (route: Route) => Promise<void> | void) {
  await page.route("**/api/contribute", handler);
}

const accepts = (route: Route) =>
  route.fulfill({ status: 200, json: { ok: true } });

const unavailable = (route: Route) =>
  route.fulfill({ status: 503, json: { ok: false, error: "unavailable" } });

test("suggesting a shop, from Me to a confirmation", async ({ page }) => {
  const sent: unknown[] = [];

  await intake(page, async (route) => {
    sent.push(route.request().postDataJSON());
    await accepts(route);
  });

  await page.goto("/me");
  await page.getByRole("link", { name: /suggest a pen shop/i }).click();

  await expect(page).toHaveURL(/\/suggest-shop$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Suggest a pen shop");

  await page.getByLabel(/^shop name/i).fill("Pen and Paper");
  await page.getByLabel(/^country/i).fill("South Korea");
  await page.getByRole("button", { name: /send this suggestion/i }).click();

  await expect(page.getByRole("status")).toContainText(/thanks for contributing/i);

  expect(sent).toHaveLength(1);
  expect(sent[0]).toMatchObject({
    kind: "suggestion",
    values: { shop_name: "Pen and Paper", country: "South Korea" },
  });

  // Somebody who knows one missing shop often knows two, and the second starts
  // blank rather than as the first one edited.
  await page.getByRole("button", { name: /suggest another shop/i }).click();
  await expect(page.getByLabel(/^shop name/i)).toHaveValue("");
});

test("the form does not post until it has what it needs", async ({ page }) => {
  let calls = 0;

  await intake(page, async (route) => {
    calls += 1;
    await accepts(route);
  });

  await page.goto("/suggest-shop");
  await page.getByRole("button", { name: /send this suggestion/i }).click();

  await expect(page.getByTestId("contribute-problem")).toContainText(
    /2 things need a look/i,
  );
  expect(calls).toBe(0);

  // The summary is a route into the field it is about.
  await page.getByRole("link", { name: /country is needed/i }).click();
  await expect(page.getByLabel(/^country/i)).toBeFocused();
});

test("correcting a listing carries the shop, and never asks which one", async ({ page }) => {
  const sent: unknown[] = [];

  await intake(page, async (route) => {
    sent.push(route.request().postDataJSON());
    await accepts(route);
  });

  await page.goto("/shops/ty-lee-pen-shop");
  await page.getByRole("link", { name: /report incorrect information/i }).click();

  await expect(page).toHaveURL(/\/shops\/ty-lee-pen-shop\/report$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("TY Lee Pen Shop");

  // Nothing on this form asks the reader to identify the listing.
  await expect(page.getByLabel(/shop name/i)).toHaveCount(0);

  // "Choose one" is the starting state, not a choice: it cannot be selected.
  await expect(
    page.getByLabel(/what needs to be fixed/i).locator('option[value=""]'),
  ).toBeDisabled();

  await page.getByLabel(/what needs to be fixed/i).selectOption("missing");
  await page.getByLabel(/tell us more/i).fill("They repair nibs, which isn’t listed.");
  await page.getByRole("button", { name: /send this correction/i }).click();

  await expect(page.getByRole("status")).toContainText(/thanks for reporting/i);
  expect(sent[0]).toMatchObject({
    kind: "correction",
    shopSlug: "ty-lee-pen-shop",
    values: { correction_type: "missing" },
  });
});

test("a correction for a listing that does not exist is not a page", async ({ page }) => {
  const response = await page.goto("/shops/not-a-real-shop/report");

  expect(response?.status()).toBe(404);
});

/**
 * The rule the whole flow is built under: no invented success.
 */
test("an intake that is down is reported, not papered over", async ({ page }) => {
  await intake(page, unavailable);

  await page.goto("/suggest-shop");
  await page.getByLabel(/^shop name/i).fill("Pen and Paper");
  await page.getByLabel(/^city/i).fill("Kuala Lumpur");
  await page.getByLabel(/^country/i).fill("Malaysia");
  await page.getByLabel(/^local name/i).fill("激墨");
  await page.getByLabel(/what makes it worth a visit/i).fill("A wall of nibs.");
  await page.getByRole("button", { name: /send this suggestion/i }).click();

  const failure = page.getByTestId("contribute-problem");
  await expect(failure).toContainText(/did not send/i);

  // The email route has no service behind it to be unavailable.
  await expect(failure.getByRole("link", { name: /by email/i })).toHaveAttribute(
    "href",
    /^mailto:hello@nibatlas\.com/,
  );

  // Nothing typed is lost, and no confirmation is shown.
  await expect(page.getByLabel(/^shop name/i)).toHaveValue("Pen and Paper");
  await expect(page.getByLabel(/what makes it worth a visit/i)).toHaveValue(
    "A wall of nibs.",
  );
  await expect(page.getByRole("status")).toHaveCount(0);
});

test("help answers the coverage question by pointing at one place", async ({ page }) => {
  await page.goto("/me");
  await page.getByRole("link", { name: /^help/i }).click();

  await expect(page).toHaveURL(/\/help$/);

  /*
   * Coverage is named on About and nowhere else. Two pages both listing the
   * countries is two places to be wrong, and it was already wrong in one.
   */
  const body = await page.locator("article").innerText();
  expect(body).not.toMatch(/Singapore, Japan,? and Taiwan/i);

  await page.getByRole("link", { name: /about nib atlas/i }).click();
  await expect(page).toHaveURL(/\/about$/);
});

test("every contribution route is reachable without an account", async ({ page }) => {
  for (const path of ["/help", "/suggest-shop", "/shops/ty-lee-pen-shop/report"]) {
    const response = await page.goto(path);

    expect(response?.status(), path).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  }
});
