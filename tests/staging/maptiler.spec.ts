import { expect, test } from "@playwright/test";

test("renders real MapTiler geography through the static MapLibre worker", async ({
  page,
  request,
}, testInfo) => {
  const browserErrors: string[] = [];
  const successfulMapTilerResponses = new Set<string>();
  const failedMapTilerResponses = new Map<string, number>();

  page.on("pageerror", (error) => browserErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") {
      browserErrors.push(message.text());
    }
  });
  page.on("response", (response) => {
    if (!response.url().includes("api.maptiler.com")) {
      return;
    }

    const resourcePath = new URL(response.url()).pathname;

    if (response.ok()) {
      successfulMapTilerResponses.add(resourcePath);
    } else {
      failedMapTilerResponses.set(resourcePath, response.status());
    }
  });

  const worker = await request.get("/maplibre/maplibre-gl-worker.mjs");
  const shared = await request.get("/maplibre/maplibre-gl-shared.mjs");

  expect(worker.ok()).toBe(true);
  expect(shared.ok()).toBe(true);
  expect(await worker.text()).toContain("maplibre-gl-shared.mjs");

  await page.goto("/");
  await expect(page.getByTestId("map-canvas")).toBeVisible();
  await expect(page.locator(".maplibregl-ctrl-attrib")).toContainText("MapTiler");
  await expect(page.locator(".maplibregl-ctrl-attrib")).toContainText("OpenStreetMap");

  await page.waitForTimeout(2_000);
  await page.screenshot({
    path: testInfo.outputPath("maptiler-geography.png"),
    fullPage: false,
  });

  await expect
    .poll(() => successfulMapTilerResponses.size, {
      message: "MapTiler style and geography resources should load successfully",
      timeout: 30_000,
    })
    .toBeGreaterThan(2);

  expect(Object.fromEntries(failedMapTilerResponses)).toEqual({});
  expect(browserErrors).toEqual([]);
});

/**
 * The shop page's location preview, against the real basemap.
 *
 * The preview is the one surface that cannot be checked anywhere else: the
 * staging MapTiler key is restricted to the staging origin, and every other
 * environment falls back to the offline style, which draws nothing at street
 * zoom. So this is where "is the picture actually a map?" is answered — and
 * where the licence attribution the style carries is confirmed to render inside
 * the preview's own frame rather than only on the map screen.
 */
test("draws a shop's location preview from real MapTiler geography", async ({
  page,
}, testInfo) => {
  const failedMapTilerResponses = new Map<string, number>();

  page.on("response", (response) => {
    if (response.url().includes("api.maptiler.com") && !response.ok()) {
      failedMapTilerResponses.set(new URL(response.url()).pathname, response.status());
    }
  });

  await page.goto("/");
  await expect(page.getByTestId("map-canvas")).toBeVisible();

  const dismiss = page.getByRole("button", { name: "Dismiss introduction" });
  if (await dismiss.isVisible().catch(() => false)) await dismiss.click();

  await expect(page.getByTestId("explore")).toHaveAttribute("data-explore-status", "idle");

  const card = page.getByRole("article", { name: "M2 Tokyo Demo Fixture" });
  await expect(card).toBeVisible();
  await card.getByRole("link", { name: "M2 Tokyo Demo Fixture" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

  const preview = page.getByTestId("shop-location-map");
  await preview.scrollIntoViewIfNeeded();
  await expect(preview).toBeVisible();

  // The style's own attribution, inside the preview and not clipped away.
  await expect(preview.locator(".maplibregl-ctrl-attrib")).toContainText("MapTiler");
  await expect(preview.locator(".maplibregl-ctrl-attrib")).toContainText("OpenStreetMap");
  await expect(preview.locator(".maplibregl-canvas")).toBeVisible();
  // Every handler is off, so the renderer never claims the interactive class.
  await expect(preview.locator(".maplibregl-map")).not.toHaveClass(/maplibregl-interactive/);

  // A wheel over the preview scrolls the page rather than zooming the map.
  const box = (await preview.boundingBox())!;
  const before = await page.evaluate(() => window.scrollY);

  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(0, 400);
  await page.waitForTimeout(500);

  expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(before);

  await expect(page.getByRole("link", { name: /get directions/i })).toBeVisible();

  await page.waitForTimeout(1_500);
  await preview.scrollIntoViewIfNeeded();
  await page.screenshot({
    path: testInfo.outputPath("shop-location-preview.png"),
    fullPage: false,
  });

  expect(Object.fromEntries(failedMapTilerResponses)).toEqual({});
});
