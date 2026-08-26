import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
});

test("the stamp ceremony has an instant reduced-motion treatment", async ({ page }) => {
  await page.goto("/shops/juspirit-banqiao");

  await page.getByRole("button", { name: /collect stamp \(simulated\)/i }).click();
  await page.getByRole("button", { name: /simulate: i am at this shop/i }).click();

  const dialog = page.getByRole("dialog", { name: /impression collected/i });
  await expect(dialog).toBeVisible();

  // Settled from the first frame: no descent, no press, no flash.
  const plate = dialog.locator("[data-phase]");
  await expect(plate).toHaveAttribute("data-reduced", "true");
  await expect(plate).toHaveAttribute("data-phase", "settled");

  const impression = plate.locator("figure").first();
  await expect(impression).toBeVisible();
  expect(
    await impression.evaluate((node) => Number(getComputedStyle(node).opacity)),
  ).toBeCloseTo(1, 1);

  // Every part of the outcome is still stated.
  await expect(dialog.getByRole("status")).toContainText("Juspirit");
  await expect(dialog.getByRole("link", { name: /open in passport/i })).toBeVisible();
});

test("the Passport changes pages without spatial animation", async ({ page }) => {
  await page.goto("/passport");
  await page.getByRole("button", { name: /open passport/i }).click();

  const state = async () =>
    page.evaluate(() => {
      const book = document.querySelector("[data-mode]");
      const slots = [...document.querySelectorAll("[data-side]")].filter((node) =>
        node.className.includes("leafSlot"),
      );

      return {
        reduced: book?.getAttribute("data-reduced-motion") === "true",
        opened: book?.getAttribute("data-opened") === "true",
        turner: document.querySelector('[class*="turner"]') !== null,
        pages: slots.map((slot) => slot.querySelector("h3")?.textContent ?? null),
      };
    });

  const opened = await state();
  expect(opened.reduced).toBe(true);
  expect(opened.opened).toBe(true);

  await page.getByRole("button", { name: /next page/i }).click();
  const after = await state();

  // The content changed immediately, and no leaf was ever put in flight.
  expect(after.turner).toBe(false);
  expect(after.pages).not.toEqual(opened.pages);

  // Controls and the announcement survive.
  await expect(page.getByRole("button", { name: /previous page/i })).toBeEnabled();
  await expect(page.getByText(/use the page buttons or the arrow keys/i)).toBeVisible();
});

test("map interaction still works with reduced motion", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("map-canvas")).toBeVisible();
  await expect(page.getByRole("list", { name: /shops in the searched area/i })).toBeVisible();
});
