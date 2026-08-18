import { expect, test } from "@playwright/test";

test("renders the map shell with a visible demo marker", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByTestId("map-canvas")).toBeVisible();
  await expect(page.getByText("Demo data").first()).toBeVisible();
});

test("reports application health", async ({ request }) => {
  const response = await request.get("/api/health");

  expect(response.ok()).toBe(true);
  expect(await response.json()).toMatchObject({
    service: "nibatlas",
    status: "ok",
  });
});
