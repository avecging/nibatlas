import { expect, test } from "@playwright/test";

/**
 * Me, checked against the two properties the Milestone 1 review found broken:
 * visited geography must come from stamps rather than from seals, and the
 * pending-action badge must not squeeze the row text at 360 px.
 */
test("reports countries and localities visited, separately from seals", async ({
  page,
}) => {
  await page.goto("/me");

  const visited = page.getByRole("region", { name: /places visited/i });
  const seals = page.getByRole("region", { name: /seal progress/i });

  // Seeded state: six stamps across three countries and five localities, but
  // only Singapore's country seal is earned. If seals stood in for visits, this
  // would read 1.
  await expect(visited.getByText("Countries visited")).toBeVisible();
  await expect(visited.getByText("Localities visited")).toBeVisible();
  await expect(
    visited.locator("p", { has: page.getByText("Countries visited") }),
  ).toContainText("3");
  await expect(
    visited.locator("p", { has: page.getByText("Localities visited") }),
  ).toContainText("5");

  // Every visited country is named, with its localities. Singapore is both a
  // country and its own locality here, so the country heading is matched by role.
  for (const country of ["Japan", "Singapore", "Taiwan"]) {
    await expect(
      visited.getByText(country, { exact: true }).first(),
    ).toBeVisible();
  }
  await expect(visited.getByText(/Chūō, Tokyo/)).toBeVisible();
  await expect(visited.getByText(/Naka, Yokohama/)).toBeVisible();

  // Seals are their own section, and count only what is actually earned.
  await expect(seals.getByText("Country seals")).toBeVisible();
  await expect(
    seals.locator("p", { has: page.getByText("Country seals") }),
  ).toContainText("1");
  await expect(seals.getByText(/Country seal earned/)).toBeVisible();
  await expect(
    seals.getByText(/2 of 4 curated shops collected/).first(),
  ).toBeVisible();

  // The coverage-set version behind that denominator is reviewer instrumentation
  // and must not appear in the product surface.
  await expect(seals.getByText(/curated set [a-z]{2}-/i)).toHaveCount(0);

  // Places visited points into the Passport itself.
  await expect(visited.getByRole("link", { name: /open passport/i })).toHaveAttribute(
    "href",
    "/passport",
  );
});

test("the profile row keeps its text readable at 360 px", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/me");

  const detail = page.getByText(
    /Saving shops and keeping a Passport need an account/i,
  );
  // Normal mode states the same fact without the milestone number.
  const badge = page.getByText("Sign-in not available yet");

  const detailBox = await detail.boundingBox();
  const badgeBox = await badge.boundingBox();

  expect(detailBox).not.toBeNull();
  expect(badgeBox).not.toBeNull();

  // The badge sits below the text rather than beside it, so the detail keeps the
  // full column width.
  expect(badgeBox!.y).toBeGreaterThanOrEqual(detailBox!.y + detailBox!.height - 1);
  expect(detailBox!.width).toBeGreaterThan(240);
});
