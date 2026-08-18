import { expect, test } from "@playwright/test";

test.describe("mobile results sheet", () => {
  test.skip(
    ({ viewport }) => (viewport?.width ?? 0) >= 1024,
    "The sheet is replaced by the desktop map/list split at 1024 px.",
  );

  test("moves between Peek, Half, and Full without fighting the map", async ({ page }) => {
    await page.goto("/");

    const sheet = page.getByTestId("results-sheet");
    await expect(sheet).toHaveAttribute("data-state", "peek");

    const handle = page.getByRole("button", { name: /results sheet/i });
    await handle.click();
    await expect(sheet).toHaveAttribute("data-state", "half");

    await handle.click();
    await expect(sheet).toHaveAttribute("data-state", "full");

    await handle.click();
    await expect(sheet).toHaveAttribute("data-state", "half");
  });

  test("keeps the list reachable from the keyboard", async ({ page }) => {
    await page.goto("/");

    const handle = page.getByRole("button", { name: /results sheet/i });
    await handle.focus();
    await page.keyboard.press("ArrowUp");

    await expect(page.getByTestId("results-sheet")).toHaveAttribute("data-state", "half");
  });

  test("selecting a card keeps the sheet and map in step", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("list", { name: /shops in the searched area/i })).toBeVisible();

    const firstCard = page.getByRole("article").first();
    const name = await firstCard.getByRole("button").first().textContent();
    await firstCard.getByRole("button").first().click();

    await expect(firstCard).toHaveAttribute("data-selected", "true");
    await expect(page.getByText(`Selected: ${name}`)).toBeVisible();
  });
});
