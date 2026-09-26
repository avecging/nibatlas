import { expect, test } from "@playwright/test";
import { decodeNearbyShopsV1 } from "@/src/api/v1/shop-read";
import { stagingCatalogue } from "./catalogue-data";

test("reads the current catalogue and preserves map-detail return, or renders empty", async ({
  page, request,
}, testInfo) => {
  const catalogue = await stagingCatalogue(request);
  const shop = catalogue.shops[0];
  const browserRequestUrls: string[] = [];
  page.on("request", (entry) => browserRequestUrls.push(entry.url()));
  await page.goto(shop ? `/?shop=${encodeURIComponent(shop.slug)}` : "/");
  await expect(page.getByTestId("map-canvas")).toBeVisible();
  const dismiss = page.getByRole("button", { name: "Dismiss introduction" });
  if (await dismiss.isVisible().catch(() => false)) await dismiss.click();
  await expect(page.getByTestId("explore")).toHaveAttribute("data-explore-status", "idle");

  if (shop) {
    const card = page.locator(`article[data-shop-id="${shop.id}"]`);
    await expect(card).toHaveAttribute("data-selected", "true");
    await card.getByRole("link", { name: shop.name, exact: true }).click();
    await expect(page.getByRole("heading", { level: 1, name: shop.name, exact: true })).toBeVisible();
    await page.getByRole("link", { name: "Back to map" }).click();
    await expect(card).toHaveAttribute("data-selected", "true");
  } else {
    expect(catalogue.truncated).toBe(false);
    await expect(page.getByText(/No shops match this area and these filters/)).toBeVisible();
    await expect(page.getByRole("article")).toHaveCount(0);
  }

  // Existing public shop coordinates, or a fixed Singapore point for empty data.
  // Never a user's position, and never placed in a request URL.
  const nearby = await request.post("/api/v1/shops/nearby", {
    data: { latitude: shop?.position.latitude ?? 1.3521,
      longitude: shop?.position.longitude ?? 103.8198, radiusMeters: 5000, limit: 5 },
  });
  expect(nearby.ok()).toBe(true);
  const nearbyData = decodeNearbyShopsV1(await nearby.json());
  if (!shop) expect(nearbyData.shops).toHaveLength(0);
  expect(new URL(nearby.url()).search).toBe("");
  expect(browserRequestUrls.some((url) => /[?&](latitude|longitude)=/.test(url))).toBe(false);
  await page.screenshot({ path: testInfo.outputPath("catalogue-api-demo.png"), animations: "disabled" });
});
