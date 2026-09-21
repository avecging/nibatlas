import { expect, test } from "@playwright/test";
import { decodeShopDetailV1 } from "@/src/api/v1/shop-read";
import { projectShopDetail } from "@/src/features/shops/shop-detail-projection";
import { shopVisitFacts } from "@/src/features/shops/shop-visit-facts";
import { stagingCatalogue } from "./catalogue-data";

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
  page, request,
}, testInfo) => {
  const successfulMapTilerResponses = new Set<string>();
  const failedMapTilerResponses = new Map<string, number>();

  page.on("response", (response) => {
    if (response.url().includes("api.maptiler.com")) {
      const path = new URL(response.url()).pathname;
      if (response.ok()) successfulMapTilerResponses.add(path);
      else failedMapTilerResponses.set(path, response.status());
    }
  });

  const catalogue = await stagingCatalogue(request);
  let selected: { slug: string; name: string; fact: string } | undefined;
  // Bounded read-only discovery. Missing eligible data is an explicit coverage
  // gap, never a reason to publish a fixture into the founder's catalogue.
  for (const candidate of catalogue.shops.slice(0, 20)) {
    const response = await request.get(`/api/v1/shops/${encodeURIComponent(candidate.slug)}`);
    expect(response.ok()).toBe(true);
    const detail = decodeShopDetailV1(await response.json());
    expect(detail).not.toBeNull();
    const projected = projectShopDetail(detail!, { demoRecords: true });
    const fact = shopVisitFacts(projected).gettingThere[0];
    if (fact) { selected = { slug: candidate.slug, name: candidate.name, fact: fact.value }; break; }
  }
  test.skip(!selected, "No eligible published shop among the first 20 staging records; location-preview coverage pending catalogue publication.");
  // Load detail directly so map-screen traffic cannot satisfy this map's checks.
  await page.goto(`/shops/${encodeURIComponent(selected!.slug)}`);
  await expect(page.getByRole("heading", { level: 1, name: selected!.name, exact: true })).toBeVisible();
  await expect(page.getByRole("region", { name: "Plan your visit" })
    .getByText(selected!.fact)).toBeVisible();

  const preview = page.getByTestId("shop-location-map");
  await preview.scrollIntoViewIfNeeded();
  await expect(preview).toBeVisible();

  // The style's own attribution, inside the preview and not clipped away.
  await expect(preview.locator(".maplibregl-ctrl-attrib")).toContainText("MapTiler");
  await expect(preview.locator(".maplibregl-ctrl-attrib")).toContainText("OpenStreetMap");
  await expect(preview.locator(".maplibregl-canvas")).toBeVisible();
  await expect.poll(() => successfulMapTilerResponses.size, {
    message: "The shop preview should load real MapTiler style and geography",
  }).toBeGreaterThan(2);
  // Every handler is off, so the renderer never claims the interactive class.
  await expect(preview.locator(".maplibregl-map")).not.toHaveClass(/maplibregl-interactive/);

  // A wheel over the preview scrolls the page rather than zooming the map.
  const box = (await preview.boundingBox())!;
  const before = await page.evaluate(() => window.scrollY);

  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  // A short detail page can already be at its bottom after revealing the map.
  // Scroll toward available space, then verify the wheel escapes the preview.
  const delta = before > 0 ? -400 : 400;
  await page.mouse.wheel(0, delta);
  await expect.poll(async () => (await page.evaluate(() => window.scrollY)) - before)
    [delta < 0 ? "toBeLessThan" : "toBeGreaterThan"](0);

  await expect(page.getByRole("link", { name: /get directions/i })).toBeVisible();

  await page.waitForTimeout(1_500);
  await preview.scrollIntoViewIfNeeded();
  await page.screenshot({
    path: testInfo.outputPath("shop-location-preview.png"),
    fullPage: false,
  });

  expect(Object.fromEntries(failedMapTilerResponses)).toEqual({});
});
