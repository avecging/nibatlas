import { expect, test } from "@playwright/test";

test("renders the map shell as the product, with no prototype notice", async ({
  page,
}) => {
  await page.goto("/");

  await expect(page.getByTestId("map-canvas")).toBeVisible();
  await expect(
    page.getByRole("list", { name: /shops in the searched area/i }),
  ).toBeVisible();

  // Milestone 1 put a "Prototype sample" badge beside the result count on every
  // breakpoint. WP1 moves it behind reviewer mode.
  await expect(page.getByText("Prototype sample")).toHaveCount(0);
  await expect(page.getByText("Prototype data")).toHaveCount(0);
});

test("reports application health", async ({ request }) => {
  const response = await request.get("/api/health");

  expect(response.ok()).toBe(true);
  expect(await response.json()).toMatchObject({
    service: "nibatlas",
    status: "ok",
  });
});

test("serves the MapLibre worker modules as same-origin build assets", async ({
  request,
}) => {
  const worker = await request.get("/maplibre/maplibre-gl-worker.mjs");
  const shared = await request.get("/maplibre/maplibre-gl-shared.mjs");

  expect(worker.ok()).toBe(true);
  expect(shared.ok()).toBe(true);
  expect(await worker.text()).toContain("maplibre-gl-shared.mjs");
});
