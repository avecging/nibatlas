import { expect, test, type Page } from "@playwright/test";

/**
 * The Passport book, exercised through its acceptance checks in
 * `docs/passport-interaction-spec.md`.
 */
async function bookState(page: Page) {
  return page.evaluate(() => {
    const book = document.querySelector("[data-mode]");
    const slots = [...document.querySelectorAll("[data-side]")].filter((node) =>
      node.className.includes("leafSlot"),
    );
    const turner = document.querySelector('[class*="turner"]');

    return {
      mode: book?.getAttribute("data-mode") ?? null,
      opened: book?.getAttribute("data-opened") === "true",
      reduced: book?.getAttribute("data-reduced-motion") === "true",
      pages: slots.map((slot) => slot.querySelector("h3")?.textContent ?? null),
      turner: turner
        ? {
            side: turner.getAttribute("data-side"),
            faces: [...turner.querySelectorAll("[data-face]")].map((face) => ({
              face: face.getAttribute("data-face"),
              heading: face.querySelector("h3")?.textContent ?? null,
            })),
          }
        : null,
    };
  });
}

async function open(page: Page, search = "") {
  await page.goto(`/passport${search}`);

  // The book remembers that it is open, so a second visit inside one test lands
  // on the last spread with no cover to open.
  const opener = page.getByRole("button", { name: /open passport/i });

  if (await opener.isVisible().catch(() => false)) {
    await opener.click();
  }

  await expect(page.getByRole("button", { name: /previous page/i })).toBeVisible();
  await expect
    .poll(async () => (await bookState(page)).opened, { timeout: 5000 })
    .toBe(true);
}

test("opens on a closed passport with a labelled way in", async ({ page }) => {
  await page.goto("/passport");

  const state = await bookState(page);
  expect(state.opened).toBe(false);
  await expect(page.getByRole("button", { name: /open passport/i })).toBeVisible();
  await expect(page.getByText(/open the cover/i)).toBeVisible();
});

test("desktop opens into a complete two-page spread", async ({ page, viewport }) => {
  test.skip((viewport?.width ?? 0) < 1024, "Spread mode begins at 1024 px.");

  await open(page);

  const state = await bookState(page);
  expect(state.mode).toBe("spread");
  // Both leaves carry real content, not one page and an empty half.
  expect(state.pages.filter(Boolean)).toHaveLength(2);
  await expect(page.getByTestId("passport-pager")).toHaveText(/Pages 1 and 2 of/);
});

test("mobile reads one portrait page and never needs rotating", async ({
  page,
  viewport,
}) => {
  test.skip((viewport?.width ?? 0) >= 1024, "Single-page mode is below 1024 px.");

  await open(page);

  const state = await bookState(page);
  expect(state.mode).toBe("single");
  await expect(page.getByTestId("passport-pager")).toHaveText(/Page 1 of/);
  // Nothing offers or requires a sideways reading mode in Milestone 1.
  await expect(page.getByRole("button", { name: /read sideways|rotate/i })).toHaveCount(0);
});

test("a forward turn moves the right leaf onto the left stack", async ({
  page,
  viewport,
}) => {
  test.skip((viewport?.width ?? 0) < 1024, "Spread mode begins at 1024 px.");

  await open(page);
  const before = await bookState(page);

  await page.getByRole("button", { name: /next page/i }).click();

  // Mid-turn: the moving leaf is hinged on the right of the spine, its front is
  // the page that was on the right, and its back is the page that will settle on
  // the left.
  const during = await bookState(page);
  expect(during.turner?.side).toBe("right");
  expect(during.turner?.faces[0]).toMatchObject({
    face: "front",
    heading: before.pages[1],
  });

  const landing = during.turner?.faces[1]?.heading ?? null;

  await expect.poll(async () => (await bookState(page)).turner, { timeout: 5000 }).toBeNull();

  const after = await bookState(page);
  // The leaf that turned is now the left page: it really moved stacks.
  expect(after.pages[0]).toBe(landing);
  expect(after.pages[1]).not.toBe(before.pages[1]);
});

test("a reverse turn returns the left leaf to the right stack", async ({
  page,
  viewport,
}) => {
  test.skip((viewport?.width ?? 0) < 1024, "Spread mode begins at 1024 px.");

  await open(page);
  await page.getByRole("button", { name: /next page/i }).click();
  await expect.poll(async () => (await bookState(page)).turner, { timeout: 5000 }).toBeNull();

  const before = await bookState(page);
  await page.getByRole("button", { name: /previous page/i }).click();

  const during = await bookState(page);
  // Hinged on the other side of the same spine, taking the current left page.
  expect(during.turner?.side).toBe("left");
  expect(during.turner?.faces[0]).toMatchObject({
    face: "front",
    heading: before.pages[0],
  });

  const landing = during.turner?.faces[1]?.heading ?? null;

  await expect.poll(async () => (await bookState(page)).turner, { timeout: 5000 }).toBeNull();

  const after = await bookState(page);
  expect(after.pages[1]).toBe(landing);
});

test("forward then reverse returns to the same spread", async ({ page, viewport }) => {
  test.skip((viewport?.width ?? 0) < 1024, "Spread mode begins at 1024 px.");

  await open(page);
  const start = await bookState(page);

  await page.getByRole("button", { name: /next page/i }).click();
  await expect.poll(async () => (await bookState(page)).turner, { timeout: 5000 }).toBeNull();
  await page.getByRole("button", { name: /previous page/i }).click();
  await expect.poll(async () => (await bookState(page)).turner, { timeout: 5000 }).toBeNull();

  expect((await bookState(page)).pages).toEqual(start.pages);
});

/** The page numbers printed on the visible leaves, in reading order. */
async function visibleNumbers(page: Page) {
  return page.evaluate(() =>
    [...document.querySelectorAll("[data-side]")]
      .filter((node) => node.className.includes("leafSlot"))
      .map((slot) => {
        const printed = slot.querySelector('[class*="pageNumber"]')?.textContent;

        return printed ? Number(printed) : null;
      })
      .filter((value): value is number => value !== null),
  );
}

test("rapid repeated input cannot corrupt page order", async ({ page }) => {
  await open(page);
  const start = await bookState(page);

  // Hammer the control far faster than a turn can complete.
  const next = page.getByRole("button", { name: /next page/i });
  for (let press = 0; press < 10; press += 1) {
    await next.click({ force: true }).catch(() => {});
  }

  await expect.poll(async () => (await bookState(page)).turner, { timeout: 6000 }).toBeNull();

  const after = await bookState(page);
  expect(after.pages).not.toEqual(start.pages);

  // Whatever the burst produced, the book is on a coherent position: the visible
  // leaves are consecutive pages, never a duplicate or a skipped one.
  const numbers = await visibleNumbers(page);
  for (let index = 1; index < numbers.length; index += 1) {
    expect(numbers[index]).toBe((numbers[index - 1] as number) + 1);
  }

  // And the position is still reversible: walking back settles exactly on the
  // opening spread, which a dropped or doubled turn would make impossible.
  const previous = page.getByRole("button", { name: /previous page/i });
  for (let step = 0; step < 12; step += 1) {
    if (await previous.isDisabled()) {
      break;
    }

    await previous.click();
    await expect
      .poll(async () => (await bookState(page)).turner, { timeout: 6000 })
      .toBeNull();
  }

  expect((await bookState(page)).pages).toEqual(start.pages);
});

test("the keyboard completes the same journey", async ({ page }) => {
  await open(page);
  const start = await bookState(page);

  await page.getByRole("button", { name: /next page/i }).focus();
  await page.keyboard.press("ArrowRight");
  await expect.poll(async () => (await bookState(page)).turner, { timeout: 5000 }).toBeNull();
  expect((await bookState(page)).pages).not.toEqual(start.pages);

  await page.keyboard.press("ArrowLeft");
  await expect.poll(async () => (await bookState(page)).turner, { timeout: 5000 }).toBeNull();
  expect((await bookState(page)).pages).toEqual(start.pages);

  await page.keyboard.press("End");
  await expect(page.getByRole("button", { name: /next page/i })).toBeDisabled();

  await page.keyboard.press("Home");
  await expect(page.getByRole("button", { name: /previous page/i })).toBeDisabled();
});

test("a page turn moves focus to the new page heading", async ({ page }) => {
  await open(page);

  await page.getByRole("button", { name: /next page/i }).click();
  await expect.poll(async () => (await bookState(page)).turner, { timeout: 5000 }).toBeNull();

  const focused = await page.evaluate(() => ({
    tag: document.activeElement?.tagName,
    text: document.activeElement?.textContent,
  }));

  expect(focused.tag).toBe("H3");
  expect(focused.text).toBeTruthy();
});

test("returning from a shop reopens the Passport where it was left", async ({ page }) => {
  await open(page);

  // Walk forward until a stamp link is on the visible spread.
  for (let press = 0; press < 4; press += 1) {
    const link = page.getByRole("link").filter({ hasText: /2026-/ }).first();
    if (await link.isVisible().catch(() => false)) {
      break;
    }
    await page.getByRole("button", { name: /next page/i }).click();
    await expect.poll(async () => (await bookState(page)).turner, { timeout: 5000 }).toBeNull();
  }

  const before = await bookState(page);
  await page.getByRole("link").filter({ hasText: /2026-/ }).first().click();

  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
  await page.getByRole("link", { name: /back to passport/i }).click();

  await expect.poll(async () => (await bookState(page)).opened, { timeout: 5000 }).toBe(true);
  expect((await bookState(page)).pages).toEqual(before.pages);
});

test("the Passport never shows Recent Impressions", async ({ page }) => {
  await open(page);

  for (let press = 0; press < 6; press += 1) {
    await expect(page.getByText(/recent impressions/i)).toHaveCount(0);

    const next = page.getByRole("button", { name: /next page/i });
    if (await next.isDisabled()) {
      break;
    }

    await next.click();
    await expect.poll(async () => (await bookState(page)).turner, { timeout: 5000 }).toBeNull();
  }
});

/** Brings the seals page onto the visible spread at any breakpoint. */
async function openSeals(page: Page, search = "") {
  await open(page, search);

  // The seals page is the second logical page, so it is on the opening spread on
  // desktop and one turn away on mobile.
  if (await page.getByText(/Geographic seals/i).isHidden().catch(() => true)) {
    await page.getByRole("button", { name: /next page/i }).click();
    await expect.poll(async () => (await bookState(page)).turner, { timeout: 5000 }).toBeNull();
  }

  await expect(page.getByText(/Geographic seals/i)).toBeVisible();
}

test("seal logic is shown against an explicit versioned set", async ({ page }) => {
  await openSeals(page);

  // Singapore's curated set is smaller than five and complete, so "complete" is
  // licensed. Japan and Taiwan show a plain count against the same curated set.
  await expect(page.getByText(/curated set of 2 complete/i)).toBeVisible();
  await expect(page.getByText(/2 of 4 curated shops/).first()).toBeVisible();

  // The set's version identifier proves an earned seal is never revoked when the
  // catalogue grows. That is a review concern, so it is reviewer-only — the
  // denominator a reader sees is still licensed by the same versioned set.
  await expect(page.getByText(/set sg-prototype-/)).toHaveCount(0);

  await openSeals(page, "?review=1");
  await expect(page.getByText(/set sg-prototype-/)).toBeVisible();
});

test("a new impression opens the Passport at its own locality page", async ({ page }) => {
  // Ty Lee is uncollected in the seeded prototype state, so this is a first
  // collection rather than a repeat view.
  await page.goto("/shops/ty-lee-pen-shop");
  await page.getByRole("button", { name: /collect stamp/i }).click();
  await page.getByRole("button", { name: /i am at this shop/i }).click();

  await page.getByRole("link", { name: /open in passport/i }).click();

  // The locality route, not the generic overview.
  await expect(page).toHaveURL(/\/passport\/tw\/daan-taipei$/);

  // And the book lands on that locality's page, not page one.
  await expect
    .poll(async () => (await bookState(page)).opened, { timeout: 5000 })
    .toBe(true);
  await expect
    .poll(
      async () => {
        const state = await bookState(page);
        return [...state.pages, ...(state.turner?.faces.map((f) => f.heading) ?? [])]
          .filter((heading): heading is string => heading !== null)
          .some((heading) => /Da'an, Taipei/.test(heading));
      },
      { timeout: 5000 },
    )
    .toBe(true);
});
