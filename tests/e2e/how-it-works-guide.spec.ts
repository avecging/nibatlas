import { expect, test } from "@playwright/test";

test("guide stays reachable above a full results sheet and keeps map state", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto("/");
  const dismiss = page.getByRole("button", { name: "Dismiss introduction" });
  if (await dismiss.isVisible()) await dismiss.click();
  const explore = page.getByTestId("explore");
  const help = page.getByRole("button", { name: "How Nib Atlas works" });
  await expect(help).toBeVisible();
  const before = await explore.getAttribute("data-committed-label");

  await page.getByRole("button", { name: /^Results sheet, Peek/ }).click();
  await page.getByRole("button", { name: /^Results sheet, Half/ }).click();
  await expect(page.getByTestId("results-sheet")).toHaveAttribute("data-state", "full");
  await help.click();
  await expect(page.getByRole("dialog", { name: "Welcome to Nib Atlas" })).toBeVisible();
  await page.getByRole("button", { name: "Next" }).click();
  await expect(page.getByRole("heading", { name: "Discover shops" })).toBeVisible();
  await page.getByRole("button", { name: "Close guide" }).click();
  await expect(page.getByTestId("results-sheet")).toHaveAttribute("data-state", "full");
  expect(await explore.getAttribute("data-committed-label")).toBe(before);
  await expect(help).toBeVisible();
});
