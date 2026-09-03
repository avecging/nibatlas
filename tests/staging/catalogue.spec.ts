import { expect, test } from "@playwright/test";

test("reads the demo database through v1 and preserves the map-detail return", async ({
  page,
  request,
}, testInfo) => {
  const browserRequestUrls: string[] = [];
  page.on("request", (entry) => browserRequestUrls.push(entry.url()));

  await page.goto("/");
  await expect(page.getByTestId("map-canvas")).toBeVisible();

  const dismiss = page.getByRole("button", { name: "Dismiss introduction" });
  if (await dismiss.isVisible().catch(() => false)) await dismiss.click();

  await expect(page.getByTestId("explore")).toHaveAttribute("data-explore-status", "idle");

  const marker = page.getByRole("button", { name: /^M2 Tokyo Demo Fixture, Tokyo\./ });
  await expect(marker).toBeVisible();
  await marker.click();

  const card = page.getByRole("article", { name: "M2 Tokyo Demo Fixture" });
  await expect(card).toHaveAttribute("data-selected", "true");
  await card.getByRole("link", { name: "M2 Tokyo Demo Fixture" }).click();

  await expect(page.getByRole("heading", { level: 1, name: "M2 Tokyo Demo Fixture" })).toBeVisible();
  await expect(page.getByText(/demo fixture evidence/i)).toBeVisible();

  await page.getByRole("link", { name: "Back to map" }).click();
  await expect(page.getByRole("article", { name: "M2 Tokyo Demo Fixture" })).toHaveAttribute(
    "data-selected",
    "true",
  );

  // Exercise Near Me with a published demo-shop coordinate, not a user's
  // location. Coordinates belong in the POST body and therefore never in the
  // request URL captured by ordinary edge access logs.
  const nearby = await request.post("/api/v1/shops/nearby", {
    data: { latitude: 35.681236, longitude: 139.767125, radiusMeters: 5000, limit: 5 },
  });
  expect(nearby.ok()).toBe(true);
  expect(new URL(nearby.url()).search).toBe("");
  expect(browserRequestUrls.some((url) => /[?&](latitude|longitude)=/.test(url))).toBe(false);

  await page.screenshot({
    path: testInfo.outputPath("catalogue-api-demo.png"),
    animations: "disabled",
  });
});
