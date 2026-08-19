import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
});

test("the stamp ceremony has an instant reduced-motion treatment", async ({ page }) => {
  await page.goto("/shops/demo-sendai-jozenji-pen-house");

  await page.getByRole("button", { name: /collect stamp \(simulated\)/i }).click();
  await page.getByRole("button", { name: /simulate: i am at this shop/i }).click();

  const dialog = page.getByRole("dialog", { name: /impression collected/i });
  await expect(dialog).toBeVisible();

  // The impression is settled immediately rather than animating a press.
  const animation = await dialog
    .locator("figure")
    .evaluate((node) => getComputedStyle(node).animationName);
  expect(animation).toBe("none");

  await expect(dialog.getByRole("status")).toContainText("Demo Sendai Jōzenji Pen House");
});

test("map interaction still works with reduced motion", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("map-canvas")).toBeVisible();
  await expect(page.getByRole("list", { name: /shops in the searched area/i })).toBeVisible();
});
