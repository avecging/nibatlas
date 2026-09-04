import { expect, test } from "@playwright/test";

/**
 * No two words run together across an inline element.
 *
 * JSX drops the space between `</strong>` and the word after it when the text
 * node that follows wraps onto the next source line. It is invisible in review —
 * the source reads correctly and only the rendered output is wrong — and it had
 * already produced two defects on Privacy before anyone noticed, so it is
 * asserted rather than watched for.
 *
 * The fix at each site is an explicit `{" "}`. This test is what says whether
 * one is missing.
 */
const PROSE_ROUTES = [
  "/about",
  "/help",
  "/privacy",
  "/suggest-shop",
  "/shops/ty-lee-pen-shop/report",
  "/shops/juspirit-banqiao",
  "/me",
  "/login",
];

/**
 * A closing inline tag followed immediately by a word character, or the reverse.
 *
 * `span` is deliberately not in this list. A span is as often used to style a
 * character that *should* touch the word beside it — the required marker on the
 * contribution forms is `Shop name<span>*</span>` — so flagging it reports the
 * intended thing as a defect. Spans inside a sentence are covered where it
 * matters by asserting the rendered line, as `ContributeForm.test.tsx` does for
 * the required-fields legend.
 */
const GLUED = /<\/(strong|a|em)>[A-Za-z0-9]|[A-Za-z0-9]<(strong|a|em)[ >]/g;

for (const path of PROSE_ROUTES) {
  test(`${path} has no words run together across an inline element`, async ({ page }) => {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    const html = await page.locator("main").innerHTML();

    // Reported with surrounding text, because the tag name alone does not say
    // which sentence to go and look at.
    const glued = [...html.matchAll(GLUED)].map((match) =>
      html.slice(Math.max(0, match.index - 50), match.index + 30),
    );

    expect(glued).toEqual([]);
  });
}


test("/about keeps the catalogue count grammatically separated", async ({ page }) => {
  await page.goto("/about");

  await expect(
    page.getByText(
      /Today the catalogue holds \d+ shops? across the places below\./,
    ),
  ).toBeVisible();
  await expect(page.locator("main")).not.toContainText(/shops?across/i);
});
