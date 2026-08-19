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
