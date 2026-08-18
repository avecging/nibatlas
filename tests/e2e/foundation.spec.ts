import { expect, test } from "@playwright/test";

test("renders the Nib Atlas foundation", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Nib Atlas" })).toBeVisible();
  await expect(page.getByText("No production shop data")).toBeVisible();
});

test("reports application health", async ({ request }) => {
  const response = await request.get("/api/health");

  expect(response.ok()).toBe(true);
  expect(await response.json()).toMatchObject({
    service: "nibatlas",
    status: "ok",
  });
});
