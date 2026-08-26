import { expect, test } from "@playwright/test";

test("renders the map shell with a visible prototype notice", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByTestId("map-canvas")).toBeVisible();
  await expect(page.getByText("Prototype sample")).toBeVisible();
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
