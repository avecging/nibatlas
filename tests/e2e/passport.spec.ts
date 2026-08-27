import { expect, test, type Page } from "@playwright/test";

import {
  PASSPORT_VIEW_STORAGE_KEYS,
  seedEmptyCollection,
  seedPassportView,
  seedSampleCollection,
  seedSignedInPreview,
  useNormalMode,
  useReviewerMode,
} from "../support/local-state";

/**
 * The Passport, end to end.
 *
 * Two things are under test here that no unit test can reach: the journeys that
 * cross a reload or a navigation — a remembered mode, a resumed spread, a trip
 * to a shop and back — and the book's own physical behaviour, which is checked
 * against the acceptance list in `docs/passport-interaction-spec.md`.
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

/** The stored view record, as the application would read it back. */
async function storedView(page: Page, scope: "normal" | "reviewer" = "normal") {
  return page.evaluate((key) => {
    const raw = window.localStorage.getItem(key);

    return raw === null ? null : (JSON.parse(raw) as Record<string, unknown>);
  }, PASSPORT_VIEW_STORAGE_KEYS[scope]);
}

function toggle(page: Page) {
  return page.getByRole("group", { name: "Passport view" });
}

function modeButton(page: Page, name: "List" | "Book") {
  return toggle(page).getByRole("button", { name, exact: true });
}

async function selectedMode(page: Page): Promise<"List" | "Book"> {
  await expect(toggle(page)).toBeVisible();

  return (await modeButton(page, "List").getAttribute("aria-pressed")) === "true"
    ? "List"
    : "Book";
}

/** Opens Passport in Book mode with the cover already behind the reader. */
async function openBook(page: Page, path = "/passport") {
  await page.goto(path);
  await expect(toggle(page)).toBeVisible();

  if ((await selectedMode(page)) !== "Book") {
    await modeButton(page, "Book").click();
  }

  const opener = page.getByRole("button", { name: /open passport/i });

  if (await opener.isVisible().catch(() => false)) {
    await opener.click();
  }

  await expect(page.getByRole("button", { name: /previous page/i })).toBeVisible();
  await expect
    .poll(async () => (await bookState(page)).opened, { timeout: 5000 })
    .toBe(true);
}

/* ---------------------------------------------------------------------- */
/* Modes and remembered state                                             */
/* ---------------------------------------------------------------------- */

test.describe("List and Book", () => {
  test("a clean normal device lands in List, with List on the left", async ({ page }) => {
    await useNormalMode(page);
    await page.goto("/passport");
    // `allInnerTexts` does not wait for the element to exist, and the device's
    // own state resolves after mount.
    await expect(toggle(page)).toBeVisible();

    const labels = await toggle(page).getByRole("button").allInnerTexts();

    expect(labels).toEqual(["List", "Book"]);
    expect(await selectedMode(page)).toBe("List");
  });

  test("a clean reviewer device lands in Book", async ({ page }) => {
    await useReviewerMode(page);
    await page.goto("/passport");

    expect(await selectedMode(page)).toBe("Book");
  });

  test("neither default is stored as though the reader had chosen it", async ({
    page,
  }) => {
    await useNormalMode(page);
    await seedSampleCollection(page);
    await page.goto("/passport");
    await expect(toggle(page)).toBeVisible();

    // A stored "list" here would make the reviewer default unreachable, and
    // would tell a reviewer the tester had chosen the list when they had not.
    expect(await storedView(page)).toBeNull();
  });

  test("an explicit choice survives navigation and reload", async ({ page }) => {
    await useNormalMode(page);
    await seedSampleCollection(page);
    await page.goto("/passport");
    await modeButton(page, "Book").click();

    expect((await storedView(page))?.mode).toBe("book");

    await page.goto("/me");
    await page.goto("/passport");
    expect(await selectedMode(page)).toBe("Book");

    await page.reload();
    expect(await selectedMode(page)).toBe("Book");

    // And back again, in the other direction.
    await modeButton(page, "List").click();
    await page.reload();
    expect(await selectedMode(page)).toBe("List");
  });

  test("a reviewer's choice does not become the tester's", async ({ page }) => {
    await useReviewerMode(page);
    await page.goto("/passport");
    await modeButton(page, "List").click();

    expect((await storedView(page, "reviewer"))?.mode).toBe("list");
    expect(await storedView(page, "normal")).toBeNull();

    // Leaving reviewer mode returns the device to its own default.
    await page.goto("/passport?review=0");
    expect(await selectedMode(page)).toBe("List");
    expect(await storedView(page, "normal")).toBeNull();
  });

  test("a corrupt stored record falls back to the default", async ({ page }) => {
    await useReviewerMode(page);
    await seedPassportView(page, "{ not json at all", "reviewer");
    await page.goto("/passport");

    expect(await selectedMode(page)).toBe("Book");
  });

  test("normal and reviewer collections stay isolated", async ({ page }) => {
    await useNormalMode(page);
    await seedSampleCollection(page, "normal");
    await page.goto("/passport");
    await expect(page.getByText("Shop stamps")).toBeVisible();

    // Reviewer mode shows its own seeded demonstration collection…
    await page.goto("/passport?review=1");
    await expect(toggle(page)).toBeVisible();
    await modeButton(page, "List").click();
    await expect(page.getByRole("heading", { name: "Japan" })).toBeVisible();

    // …and coming back, the tester's own is untouched.
    await page.goto("/passport?review=0");
    await expect(page.getByText("Shop stamps")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Japan" })).toBeVisible();
  });
});

/* ---------------------------------------------------------------------- */
/* List mode                                                              */
/* ---------------------------------------------------------------------- */

test.describe("List mode", () => {
  test.beforeEach(async ({ page }) => {
    await useNormalMode(page);
    await seedSampleCollection(page);
  });

  test("reports the collection and links its geography", async ({ page }) => {
    await page.goto("/passport");

    const stats = page.getByRole("heading", { level: 1, name: "Passport" });
    await expect(stats).toBeVisible();

    await expect(page.getByText("Shop stamps")).toBeVisible();
    await expect(page.getByText("Countries visited")).toBeVisible();
    await expect(page.getByText("Localities visited")).toBeVisible();

    // Three countries are visited while only one country seal is earned, so a
    // seal is plainly not standing in for a visit.
    for (const country of ["Japan", "Singapore", "Taiwan"]) {
      await expect(page.getByRole("heading", { level: 2, name: country })).toBeVisible();
    }

    await expect(page.getByRole("link", { name: "Japan" })).toHaveAttribute(
      "href",
      "/passport/jp",
    );
    await expect(page.getByRole("link", { name: "Chūō, Tokyo" })).toHaveAttribute(
      "href",
      "/passport/jp/chuo-tokyo",
    );
  });

  test("orders the same way twice", async ({ page }) => {
    await page.goto("/passport");
    await expect(page.getByRole("heading", { level: 3 }).first()).toBeVisible();

    const first = await page.getByRole("heading", { level: 3 }).allInnerTexts();

    expect(first.length).toBeGreaterThan(1);

    await page.reload();
    await expect(page.getByRole("heading", { level: 3 }).first()).toBeVisible();

    expect(await page.getByRole("heading", { level: 3 }).allInnerTexts()).toEqual(first);
  });

  test("a country URL opens that country", async ({ page }) => {
    await page.goto("/passport/jp");

    await expect(page.getByRole("heading", { level: 1, name: "Japan" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "Singapore" })).toHaveCount(0);
  });

  test("a locality URL opens that locality", async ({ page }) => {
    await page.goto("/passport/jp/chuo-tokyo");

    await expect(
      page.getByRole("heading", { level: 1, name: "Chūō, Tokyo" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Ginza Itoya Main Store/ }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Ginza Itoya Yokohama Motomachi/ }),
    ).toHaveCount(0);
  });

  test("a stale country or locality says so instead of pretending", async ({ page }) => {
    await page.goto("/passport/xx");
    await expect(
      page.getByRole("heading", { name: /nothing collected in this country yet/i }),
    ).toBeVisible();

    await page.goto("/passport/jp/nowhere-at-all");
    await expect(
      page.getByRole("heading", { name: /nothing collected in this locality yet/i }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: /open passport/i })).toHaveAttribute(
      "href",
      "/passport",
    );
  });

  test("remembers where the reader had scrolled to", async ({ page }) => {
    await page.goto("/passport");
    await expect(page.getByText("Shop stamps")).toBeVisible();

    await page.evaluate(() => window.scrollTo({ top: 600 }));
    await expect
      .poll(async () => (await storedView(page))?.listScrollTop ?? 0, { timeout: 5000 })
      .toBeGreaterThan(0);

    const remembered = ((await storedView(page))?.listScrollTop ?? 0) as number;

    await page.reload();
    await expect(page.getByText("Shop stamps")).toBeVisible();
    await expect
      .poll(async () => page.evaluate(() => Math.round(window.scrollY)), {
        timeout: 5000,
      })
      .toBeGreaterThan(remembered / 2);
  });
});

/* ---------------------------------------------------------------------- */
/* Empty state                                                            */
/* ---------------------------------------------------------------------- */

test("a clean normal Passport holds no history at all", async ({ page }) => {
  await useNormalMode(page);
  await page.goto("/passport");

  await expect(
    page.getByRole("heading", { name: /no stamps collected yet/i }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: /explore the map/i })).toHaveAttribute(
    "href",
    "/",
  );

  // None of the seeded demonstration collection, in either mode.
  for (const trace of [/2026-03-14/, /Ginza Itoya/, /Japan/]) {
    await expect(page.getByText(trace)).toHaveCount(0);
  }

  await modeButton(page, "Book").click();
  await expect(
    page.getByRole("heading", { name: /no stamps collected yet/i }),
  ).toBeVisible();
});

/* ---------------------------------------------------------------------- */
/* Book mode                                                              */
/* ---------------------------------------------------------------------- */

/*
 * `seedPassportView` writes only when the key is absent, so a test that needs a
 * different starting record than its `beforeEach` arranged has to stand on its
 * own. The two first-visit tests below therefore seed for themselves.
 */
test("Book mode shows the cover once, then resumes where the reader was", async ({
  page,
}) => {
  await useNormalMode(page);
  await seedSampleCollection(page);
  await seedPassportView(page, { mode: "book" });

  {
    await page.goto("/passport");
    await expect(page.getByRole("button", { name: /open passport/i })).toBeVisible();
    expect((await bookState(page)).opened).toBe(false);

    await page.getByRole("button", { name: /open passport/i }).click();
    await expect
      .poll(async () => (await bookState(page)).opened, { timeout: 5000 })
      .toBe(true);
    await expect
      .poll(async () => (await storedView(page))?.coverSeen, { timeout: 5000 })
      .toBe(true);

    // Second visit: no cover, and the reader is put back on the spread they
    // were reading rather than at page one.
    await page.getByRole("button", { name: /next page/i }).click();
    await expect.poll(async () => (await bookState(page)).turner, { timeout: 5000 }).toBeNull();

    const left = await bookState(page);

    await page.goto("/me");
    await page.goto("/passport");

    await expect(page.getByRole("button", { name: /open passport/i })).toHaveCount(0);
    await expect
      .poll(async () => (await bookState(page)).opened, { timeout: 5000 })
      .toBe(true);
    expect((await bookState(page)).pages).toEqual(left.pages);
  }
});

test("a deep link opens its locality without the cover sequence first", async ({
  page,
}) => {
  await useNormalMode(page);
  await seedSampleCollection(page);
  // `coverSeen` is deliberately false: a reader who followed a link to Ginza
  // asked for Ginza, not for a ceremony.
  await seedPassportView(page, { mode: "book" });
  await page.goto("/passport/jp/chuo-tokyo");

  await expect(page.getByRole("button", { name: /open passport/i })).toHaveCount(0);
  await expect
    .poll(async () => (await bookState(page)).pages.join(" "), { timeout: 5000 })
    .toContain("Chūō, Tokyo");
});

test.describe("Book mode", () => {
  test.beforeEach(async ({ page }) => {
    await useNormalMode(page);
    await seedSampleCollection(page);
    await seedPassportView(page, { mode: "book", coverSeen: true });
  });

  test("opens on country seals facing the most recent locality", async ({
    page,
    viewport,
  }) => {
    await page.goto("/passport");
    await expect
      .poll(async () => (await bookState(page)).opened, { timeout: 5000 })
      .toBe(true);

    const state = await bookState(page);

    if ((viewport?.width ?? 0) >= 1024) {
      // Seals on the left, the newest locality on the right.
      expect(state.pages[0]).toContain("Geographic seals");
      expect(state.pages[1]).toContain("Singapore");
    } else {
      // One portrait page, and it is the newest impressions rather than the
      // front matter. Only the right slot is painted in single mode.
      expect(state.pages.filter(Boolean)).toEqual(["Singapore"]);
    }
  });

  test("the Cover control returns to the cover deliberately", async ({ page }) => {
    await openBook(page);

    await page.getByRole("button", { name: /^cover$/i }).click();

    await expect
      .poll(async () => (await bookState(page)).opened, { timeout: 5000 })
      .toBe(false);
    await expect(page.getByRole("button", { name: /open passport/i })).toBeVisible();
  });

  test("the contents index reaches a country and a locality without paging", async ({
    page,
  }) => {
    await openBook(page);

    await page.getByRole("button", { name: /^contents$/i }).click();
    await expect(page.getByRole("heading", { name: "Contents" })).toBeVisible();

    await page.getByRole("button", { name: /Chūō, Tokyo/ }).click();
    await expect
      .poll(
        async () => (await bookState(page)).pages.join(" "),
        { timeout: 5000 },
      )
      .toContain("Chūō, Tokyo");

    await page.getByRole("button", { name: /^contents$/i }).click();
    await page.getByRole("button", { name: /^Taiwan/ }).click();
    await expect
      .poll(async () => (await bookState(page)).pages.join(" "), { timeout: 5000 })
      .toMatch(/Tainan|Kaohsiung/);
  });

  test("a remembered locality that no longer exists lands on the opening spread", async ({
    page,
  }) => {
    // Written directly, because the record seeded in `beforeEach` already
    // exists by the time this runs.
    await page.addInitScript(
      ([key, value]) => {
        try {
          window.localStorage.setItem(key as string, value as string);
        } catch {
          // Storage may be blocked; the fallback under test is the same.
        }
      },
      [
        PASSPORT_VIEW_STORAGE_KEYS.normal,
        JSON.stringify({
          mode: "book",
          coverSeen: true,
          place: { kind: "locality", countryCode: "JP", localitySlug: "atlantis" },
          listScrollTop: 0,
        }),
      ],
    );
    await page.goto("/passport");

    await expect
      .poll(async () => (await bookState(page)).opened, { timeout: 5000 })
      .toBe(true);
    await expect
      .poll(async () => (await bookState(page)).pages.join(" "), { timeout: 5000 })
      .toContain("Singapore");
  });
});

/* ---------------------------------------------------------------------- */
/* The book as an object — the Milestone 1 acceptance list                 */
/* ---------------------------------------------------------------------- */

test.describe("the book as an object", () => {
  test.beforeEach(async ({ page }) => {
    await useNormalMode(page);
    await seedSampleCollection(page);
    await seedPassportView(page, { mode: "book", coverSeen: true });
  });

  test("desktop opens into a complete two-page spread", async ({ page, viewport }) => {
    test.skip((viewport?.width ?? 0) < 1024, "Spread mode begins at 1024 px.");

    await openBook(page);

    const state = await bookState(page);
    expect(state.mode).toBe("spread");
    expect(state.pages.filter(Boolean)).toHaveLength(2);
    await expect(page.getByTestId("passport-pager")).toHaveText(/Pages 3 and 4 of/);
  });

  test("mobile reads one portrait page and never needs rotating", async ({
    page,
    viewport,
  }) => {
    test.skip((viewport?.width ?? 0) >= 1024, "Single-page mode is below 1024 px.");

    await openBook(page);

    const state = await bookState(page);
    expect(state.mode).toBe("single");
    await expect(page.getByTestId("passport-pager")).toHaveText(/Page 4 of/);
    await expect(page.getByRole("button", { name: /read sideways|rotate/i })).toHaveCount(0);
  });

  test("a forward turn moves the right leaf onto the left stack", async ({
    page,
    viewport,
  }) => {
    test.skip((viewport?.width ?? 0) < 1024, "Spread mode begins at 1024 px.");

    await openBook(page);
    const before = await bookState(page);

    await page.getByRole("button", { name: /next page/i }).click();

    const during = await bookState(page);
    expect(during.turner?.side).toBe("right");
    expect(during.turner?.faces[0]).toMatchObject({
      face: "front",
      heading: before.pages[1],
    });

    const landing = during.turner?.faces[1]?.heading ?? null;

    await expect.poll(async () => (await bookState(page)).turner, { timeout: 5000 }).toBeNull();

    const after = await bookState(page);
    expect(after.pages[0]).toBe(landing);
    expect(after.pages[1]).not.toBe(before.pages[1]);
  });

  test("a reverse turn returns the left leaf to the right stack", async ({
    page,
    viewport,
  }) => {
    test.skip((viewport?.width ?? 0) < 1024, "Spread mode begins at 1024 px.");

    await openBook(page);
    await page.getByRole("button", { name: /next page/i }).click();
    await expect.poll(async () => (await bookState(page)).turner, { timeout: 5000 }).toBeNull();

    const before = await bookState(page);
    await page.getByRole("button", { name: /previous page/i }).click();

    const during = await bookState(page);
    expect(during.turner?.side).toBe("left");
    expect(during.turner?.faces[0]).toMatchObject({
      face: "front",
      heading: before.pages[0],
    });

    const landing = during.turner?.faces[1]?.heading ?? null;

    await expect.poll(async () => (await bookState(page)).turner, { timeout: 5000 }).toBeNull();

    expect((await bookState(page)).pages[1]).toBe(landing);
  });

  test("forward then reverse returns to the same spread", async ({ page, viewport }) => {
    test.skip((viewport?.width ?? 0) < 1024, "Spread mode begins at 1024 px.");

    await openBook(page);
    const start = await bookState(page);

    await page.getByRole("button", { name: /next page/i }).click();
    await expect.poll(async () => (await bookState(page)).turner, { timeout: 5000 }).toBeNull();
    await page.getByRole("button", { name: /previous page/i }).click();
    await expect.poll(async () => (await bookState(page)).turner, { timeout: 5000 }).toBeNull();

    expect((await bookState(page)).pages).toEqual(start.pages);
  });

  test("rapid repeated input cannot corrupt page order", async ({ page }) => {
    await openBook(page);
    const start = await bookState(page);

    const next = page.getByRole("button", { name: /next page/i });
    for (let press = 0; press < 10; press += 1) {
      await next.click({ force: true }).catch(() => {});
    }

    await expect.poll(async () => (await bookState(page)).turner, { timeout: 6000 }).toBeNull();

    const numbers = await page.evaluate(() =>
      [...document.querySelectorAll("[data-side]")]
        .filter((node) => node.className.includes("leafSlot"))
        .map((slot) => {
          const printed = slot.querySelector('[class*="pageNumber"]')?.textContent;

          return printed ? Number(printed) : null;
        })
        .filter((value): value is number => value !== null),
    );

    for (let index = 1; index < numbers.length; index += 1) {
      expect(numbers[index]).toBe((numbers[index - 1] as number) + 1);
    }

    const previous = page.getByRole("button", { name: /previous page/i });
    for (let step = 0; step < 14; step += 1) {
      if (await previous.isDisabled()) {
        break;
      }

      await previous.click();
      await expect
        .poll(async () => (await bookState(page)).turner, { timeout: 6000 })
        .toBeNull();
    }

    // The first position is reachable again by an unbroken sequence of reverse
    // turns, which a dropped or doubled turn makes impossible.
    await expect(previous).toBeDisabled();
    await expect(page.getByTestId("passport-pager")).toHaveText(/(Pages 1 and 2|Page 1) of/);
    void start;
  });

  test("the keyboard completes the same journey", async ({ page }) => {
    await openBook(page);
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
    await openBook(page);

    await page.getByRole("button", { name: /next page/i }).click();
    await expect.poll(async () => (await bookState(page)).turner, { timeout: 5000 }).toBeNull();

    const focused = await page.evaluate(() => ({
      tag: document.activeElement?.tagName,
      text: document.activeElement?.textContent,
    }));

    expect(focused.tag).toBe("H3");
    expect(focused.text).toBeTruthy();
  });

  test("the Passport never shows Recent Impressions", async ({ page }) => {
    await openBook(page);

    for (let press = 0; press < 8; press += 1) {
      await expect(page.getByText(/recent impressions/i)).toHaveCount(0);

      const next = page.getByRole("button", { name: /next page/i });
      if (await next.isDisabled()) {
        break;
      }

      await next.click();
      await expect.poll(async () => (await bookState(page)).turner, { timeout: 5000 }).toBeNull();
    }
  });
});

/* ---------------------------------------------------------------------- */
/* Seals                                                                  */
/* ---------------------------------------------------------------------- */

test("seal logic is shown against an explicit versioned set", async ({ page }) => {
  await useNormalMode(page);
  await seedSampleCollection(page);
  await seedPassportView(page, { mode: "book", coverSeen: true });
  await openBook(page);

  // The seals page is the opening spread's left page on desktop and one turn
  // back on mobile.
  if (await page.getByText(/Geographic seals/i).isHidden().catch(() => true)) {
    await page.getByRole("button", { name: /previous page/i }).click();
    await expect.poll(async () => (await bookState(page)).turner, { timeout: 5000 }).toBeNull();
  }

  await expect(page.getByText(/Geographic seals/i)).toBeVisible();
  await expect(page.getByText(/curated set of 2 complete/i)).toBeVisible();
  await expect(page.getByText(/2 of 4 curated shops/).first()).toBeVisible();
  await expect(page.getByText(/set sg-prototype-/)).toHaveCount(0);
});

/* ---------------------------------------------------------------------- */
/* Stamp detail                                                           */
/* ---------------------------------------------------------------------- */

test.describe("the enlarged stamp", () => {
  test.beforeEach(async ({ page }) => {
    await useNormalMode(page);
    await seedSampleCollection(page);
  });

  test("opens from a List row, by keyboard, and returns focus", async ({ page }) => {
    await page.goto("/passport");

    const row = page.getByRole("button").filter({ hasText: /2026-03-14/ }).first();
    await row.focus();
    await page.keyboard.press("Enter");

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAttribute("aria-modal", "true");

    // Everything the impression itself records, and nothing else.
    await expect(dialog.getByText("Shop stamp")).toBeVisible();
    await expect(
      dialog.getByRole("heading", { name: "Ginza Itoya Main Store" }),
    ).toBeVisible();
    await expect(
      dialog.getByRole("paragraph").filter({ hasText: "銀座 伊東屋 本店" }),
    ).toBeVisible();

    // Locality, country and the local collection date, read off the list they
    // are defined in rather than off the impression's own artwork.
    const facts = dialog.getByRole("definition");
    await expect(facts.nth(0)).toHaveText("Chūō, Tokyo");
    await expect(facts.nth(1)).toHaveText("Japan");
    await expect(facts.nth(2)).toHaveText("2026-03-14");

    // Focus is inside the dialog and stays there.
    await page.keyboard.press("Tab");
    expect(
      await page.evaluate(() => {
        const active = document.activeElement;
        const dialogNode = document.querySelector('[role="dialog"]');

        return dialogNode?.contains(active) ?? false;
      }),
    ).toBe(true);

    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    expect(
      await page.evaluate(() => document.activeElement?.textContent ?? ""),
    ).toContain("2026-03-14");
  });

  test("closes on its own control", async ({ page }) => {
    await page.goto("/passport");
    await page.getByRole("button").filter({ hasText: /2026-03-14/ }).first().click();

    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByRole("button", { name: /close stamp/i }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  test("opens from a Book page too", async ({ page }) => {
    await seedPassportView(page, { mode: "book", coverSeen: true });
    await openBook(page);

    await page.getByRole("button").filter({ hasText: /2026-06-03/ }).first().click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByRole("heading", { name: /fook hing trading/i }),
    ).toBeVisible();
  });

  test("Open shop keeps the Passport route it was opened from", async ({ page }) => {
    await page.goto("/passport/jp/chuo-tokyo");

    await page.getByRole("button").filter({ hasText: /2026-03-14/ }).first().click();
    await page.getByRole("link", { name: /open shop/i }).click();

    await expect(page).toHaveURL(/\/shops\/ginza-itoya-main-store/);

    const back = page.getByRole("link", { name: /back to passport/i });
    await expect(back).toHaveAttribute("href", "/passport/jp/chuo-tokyo");
    await back.click();

    await expect(
      page.getByRole("heading", { level: 1, name: "Chūō, Tokyo" }),
    ).toBeVisible();
  });

  test("a crafted return path cannot send the reader off the Passport", async ({
    page,
  }) => {
    await page.goto("/shops/ginza-itoya-main-store?from=passport&back=https%3A%2F%2Fexample.com");

    await expect(page.getByRole("link", { name: /back to passport/i })).toHaveAttribute(
      "href",
      "/passport",
    );
  });
});

/* ---------------------------------------------------------------------- */
/* Journeys in and out                                                    */
/* ---------------------------------------------------------------------- */

test("browser Back from a shop restores the Passport mode and context", async ({
  page,
}) => {
  await useNormalMode(page);
  await seedSampleCollection(page);
  await seedPassportView(page, { mode: "book", coverSeen: true });
  await openBook(page);

  const before = await bookState(page);

  await page.getByRole("button").filter({ hasText: /2026-06-03/ }).first().click();
  await page.getByRole("link", { name: /open shop/i }).click();
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();

  await page.goBack();

  // The same mode, opened, on the same spread — not the cover and not page one.
  expect(await selectedMode(page)).toBe("Book");
  await expect
    .poll(async () => (await bookState(page)).opened, { timeout: 5000 })
    .toBe(true);
  expect((await bookState(page)).pages).toEqual(before.pages);
});

test("a new impression still lands on its own locality", async ({ page }) => {
  await useNormalMode(page);
  await seedSampleCollection(page);

  // Ty Lee is uncollected in the sample state, so this is a first collection.
  await page.goto("/shops/ty-lee-pen-shop");
  await page.getByRole("button", { name: /collect stamp/i }).click();
  await page.getByRole("button", { name: /i am at this shop/i }).click();
  await page.getByRole("link", { name: /open in passport/i }).click();

  await expect(page).toHaveURL(/\/passport\/tw\/daan-taipei$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "Da'an, Taipei" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /TY Lee Pen Shop/ })).toBeVisible();
});

test("Me's Places visited reach the right country and locality", async ({ page }) => {
  await useNormalMode(page);
  await seedSampleCollection(page);
  await page.goto("/me");

  const places = page.getByRole("region", { name: /places visited/i });
  await places.getByRole("link", { name: /japan/i }).click();
  await expect(page).toHaveURL(/\/passport\/jp$/);
  await expect(page.getByRole("heading", { level: 1, name: "Japan" })).toBeVisible();

  await page.goto("/me");
  await places.getByRole("link", { name: /Naka, Yokohama/ }).click();
  await expect(page).toHaveURL(/\/passport\/jp\/naka-yokohama$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "Naka, Yokohama" }),
  ).toBeVisible();
});

/* ---------------------------------------------------------------------- */
/* Identity                                                               */
/* ---------------------------------------------------------------------- */

test.describe("the identity page", () => {
  /** Turns to the front matter, whichever mode the breakpoint reads in. */
  async function openIdentity(page: Page) {
    await page.goto("/passport");
    await expect(toggle(page)).toBeVisible();
    await page.getByRole("button", { name: /^contents$/i }).click();
    await expect(page.getByRole("heading", { name: "Contents" })).toBeVisible();

    if (await page.getByText("Passport of impressions").isHidden().catch(() => true)) {
      await page.getByRole("button", { name: /previous page/i }).click();
      await expect
        .poll(async () => (await bookState(page)).turner, { timeout: 5000 })
        .toBeNull();
    }
  }

  test("shows a display name when the account has one", async ({ page }) => {
    await seedSignedInPreview(page, "Ada Lovelace");
    await seedPassportView(page, { mode: "book", coverSeen: true }, "reviewer");
    await openIdentity(page);

    await expect(page.getByRole("heading", { name: "Ada Lovelace" })).toBeVisible();
  });

  test("falls back to Your Passport, and never to an address", async ({ page }) => {
    await seedSignedInPreview(page, null);
    await seedPassportView(page, { mode: "book", coverSeen: true }, "reviewer");
    await openIdentity(page);

    await expect(page.getByRole("heading", { name: "Your Passport" })).toBeVisible();
    await expect(page.getByText("reviewer@nibatlas.example")).toHaveCount(0);
  });

  test("an anonymous device gets the same fallback", async ({ page }) => {
    await useNormalMode(page);
    await seedSampleCollection(page);
    await seedPassportView(page, { mode: "book", coverSeen: true });
    await openIdentity(page);

    await expect(page.getByRole("heading", { name: "Your Passport" })).toBeVisible();
  });
});

/* ---------------------------------------------------------------------- */
/* Reduced motion                                                         */
/* ---------------------------------------------------------------------- */

test.describe("reduced motion", () => {
  test("both modes stay complete without spatial animation", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await useNormalMode(page);
    await seedSampleCollection(page);
    await page.goto("/passport");

    // List mode has no motion to remove, and the overlay still opens and closes.
    await page.getByRole("button").filter({ hasText: /2026-03-14/ }).first().click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);

    await modeButton(page, "Book").click();
    await page.getByRole("button", { name: /open passport/i }).click();

    expect((await bookState(page)).reduced).toBe(true);
    expect((await bookState(page)).opened).toBe(true);

    // Turning still changes the page, and does so without a moving leaf.
    const start = await bookState(page);
    await page.getByRole("button", { name: /next page/i }).click();
    expect((await bookState(page)).turner).toBeNull();
    expect((await bookState(page)).pages).not.toEqual(start.pages);
  });
});

/* ---------------------------------------------------------------------- */
/* Reviewer isolation of an emptied store                                 */
/* ---------------------------------------------------------------------- */

test("an emptied reviewer store does not reseed itself", async ({ page }) => {
  await useReviewerMode(page);
  await seedEmptyCollection(page, "reviewer");
  await page.goto("/passport");

  await expect(
    page.getByRole("heading", { name: /no stamps collected yet/i }),
  ).toBeVisible();
});
