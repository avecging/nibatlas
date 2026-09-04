import { expect, test, type Page } from "@playwright/test";

import {
  COLLECTION_STORAGE_KEYS,
  PAGED_LOCALITY,
  PASSPORT_VIEW_STORAGE_KEYS,
  pagedLocalityCollections,
  REVIEWER_STORAGE_KEY,
  seedEmptyCollection,
  seedPagedLocality,
  seedPassportView,
  seedSampleCollection,
  useNormalMode,
  useReviewerMode,
} from "../support/local-state";
import { SESSION_IDENTITY, stubSession } from "../support/auth";

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

  /** Scrolls the overview and returns the offset the Passport recorded. */
  async function scrollAndRemember(page: Page, top: number) {
    await expect(page.getByText("Shop stamps")).toBeVisible();
    await page.evaluate((offset) => window.scrollTo({ top: offset }), top);

    await expect
      .poll(async () => (await storedView(page))?.listScrollTop ?? 0, { timeout: 5000 })
      .toBeGreaterThan(0);

    return ((await storedView(page))?.listScrollTop ?? 0) as number;
  }

  test("comes back to the same place after a trip through Book mode", async ({
    page,
  }) => {
    await page.goto("/passport");

    const remembered = await scrollAndRemember(page, 300);

    // Book's document is shorter, so the browser clamps the scroll on the way
    // out. A restoration latch that was only ever set would leave the reader at
    // whatever the clamp left behind.
    await modeButton(page, "Book").click();
    await expect(page.getByTestId("passport-pager")).toBeVisible();

    await modeButton(page, "List").click();
    await expect(page.getByText("Shop stamps")).toBeVisible();

    await expect
      .poll(async () => page.evaluate(() => Math.round(window.scrollY)), {
        timeout: 5000,
      })
      .toBeGreaterThan(remembered - 10);
  });

  test("comes back to the same place after a trip through a country route", async ({
    page,
  }) => {
    await page.goto("/passport");

    const remembered = await scrollAndRemember(page, 300);

    await page.getByRole("link", { name: "Japan" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Japan" })).toBeVisible();

    // The crumb, not the bottom navigation: both are called Passport.
    await page
      .getByRole("navigation", { name: "Passport" })
      .getByRole("link", { name: "Passport" })
      .click();
    await expect(page.getByText("Shop stamps")).toBeVisible();

    await expect
      .poll(async () => page.evaluate(() => Math.round(window.scrollY)), {
        timeout: 5000,
      })
      .toBeGreaterThan(remembered - 10);
  });

  test("does not carry the overview offset onto a locality route", async ({ page }) => {
    await page.goto("/passport");
    await scrollAndRemember(page, 300);

    await page.goto("/passport/jp/chuo-tokyo");
    await expect(
      page.getByRole("heading", { level: 1, name: "Chūō, Tokyo" }),
    ).toBeVisible();

    // A locality is its own destination and starts at its own top.
    expect(await page.evaluate(() => Math.round(window.scrollY))).toBeLessThan(40);
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
/* A locality that spans more than one page                               */
/* ---------------------------------------------------------------------- */

/**
 * The case country plus locality cannot describe.
 *
 * Past `STAMPS_PER_PAGE` a locality has a continuation page, and a remembered
 * place that names only the locality resolves every one of them back to its
 * first page. The fixture puts six impressions in one locality: four on its
 * first page, two on its second.
 */
test.describe("a locality across two pages", () => {
  const LOCALITY_ROUTE = `/passport/${PAGED_LOCALITY.countryCode.toLowerCase()}/${PAGED_LOCALITY.slug}`;
  /** On the locality's second page, newest first. */
  const CONTINUED_DATE = "2026-05-02";
  /** On its first page. */
  const FIRST_PAGE_DATE = "2026-05-06";

  test.beforeEach(async ({ page }) => {
    await useNormalMode(page);
    await seedPagedLocality(page);
    await seedPassportView(page, { mode: "book", coverSeen: true });
  });

  function continuedHeading(page: Page) {
    return page.getByRole("heading", { name: /\(continued\)/ });
  }

  /**
   * The impression collected on a given date.
   *
   * By role rather than by text: the date is printed inside the artwork as well
   * as in the caption, and both sit inside the one button.
   */
  function stampOn(page: Page, date: string) {
    return page.getByRole("button", { name: new RegExp(date) }).first();
  }

  /** Turns forward until the locality's continuation page is on screen. */
  async function readContinuationPage(page: Page, path = "/passport") {
    await openBook(page, path);

    for (let turn = 0; turn < 4; turn += 1) {
      if (await continuedHeading(page).isVisible().catch(() => false)) {
        return;
      }

      await page.getByRole("button", { name: /next page/i }).click();
      await expect
        .poll(async () => (await bookState(page)).turner, { timeout: 5000 })
        .toBeNull();
    }

    await expect(continuedHeading(page)).toBeVisible();
  }

  test("the fixture really does span two pages", async ({ page }) => {
    await openBook(page);

    // The first page carries four impressions and the second the rest, so the
    // rest of this describe is testing the case it means to.
    expect(pagedLocalityCollections).toHaveLength(6);
    await expect(stampOn(page, FIRST_PAGE_DATE)).toBeVisible();
    await expect(continuedHeading(page)).toHaveCount(0);
  });

  test("a reload resumes the continuation page", async ({ page }) => {
    await readContinuationPage(page);

    // The remembered place carries an impression from this page, not just the
    // locality.
    await expect
      .poll(async () => (await storedView(page))?.place, { timeout: 5000 })
      .toMatchObject({
        kind: "locality",
        localitySlug: PAGED_LOCALITY.slug,
      });
    expect(
      ((await storedView(page))?.place as { collectionId?: string } | undefined)
        ?.collectionId,
    ).toBeTruthy();

    await page.reload();

    await expect
      .poll(async () => (await bookState(page)).opened, { timeout: 5000 })
      .toBe(true);
    await expect(continuedHeading(page)).toBeVisible();
    await expect(stampOn(page, CONTINUED_DATE)).toBeVisible();
  });

  test("a reload resumes it on the locality route too", async ({ page }) => {
    await readContinuationPage(page, LOCALITY_ROUTE);
    await page.reload();

    await expect
      .poll(async () => (await bookState(page)).opened, { timeout: 5000 })
      .toBe(true);
    await expect(continuedHeading(page)).toBeVisible();
  });

  test("a stamp opened from the continuation page returns to it", async ({ page }) => {
    await readContinuationPage(page);

    await stampOn(page, CONTINUED_DATE).click();
    await expect(page.getByRole("dialog")).toBeVisible();

    const openShop = page.getByRole("link", { name: /open shop/i });
    // The route the reader is on, plus the page inside it.
    expect(decodeURIComponent((await openShop.getAttribute("href")) ?? "")).toContain(
      "back=/passport?stamp=",
    );
    await openShop.click();

    const back = page.getByRole("link", { name: /back to passport/i });
    await expect(back).toHaveAttribute("href", /^\/passport\?stamp=/);
    await back.click();

    await expect
      .poll(async () => (await bookState(page)).opened, { timeout: 5000 })
      .toBe(true);
    await expect(continuedHeading(page)).toBeVisible();
    await expect(stampOn(page, CONTINUED_DATE)).toBeVisible();
  });

  test("and returns to it from the locality route", async ({ page }) => {
    await readContinuationPage(page, LOCALITY_ROUTE);

    await stampOn(page, CONTINUED_DATE).click();
    await page.getByRole("link", { name: /open shop/i }).click();

    const back = page.getByRole("link", { name: /back to passport/i });
    await expect(back).toHaveAttribute(
      "href",
      new RegExp(`^${LOCALITY_ROUTE}\\?stamp=`),
    );
    await back.click();

    await expect(page).toHaveURL(new RegExp(`${LOCALITY_ROUTE}\\?stamp=`));
    await expect(continuedHeading(page)).toBeVisible();
  });

  test("browser Back from that shop lands on the same page", async ({ page }) => {
    await readContinuationPage(page);

    await stampOn(page, CONTINUED_DATE).click();
    await page.getByRole("link", { name: /open shop/i }).click();
    await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();

    await page.goBack();

    await expect
      .poll(async () => (await bookState(page)).opened, { timeout: 5000 })
      .toBe(true);
    await expect(continuedHeading(page)).toBeVisible();
  });

  test("a stale anchor falls back to the locality rather than erroring", async ({
    page,
  }) => {
    await page.goto(`${LOCALITY_ROUTE}?stamp=collection-that-was-cleared`);

    await expect
      .poll(async () => (await bookState(page)).opened, { timeout: 5000 })
      .toBe(true);
    // The locality's own first page, not an error and not a blank book.
    await expect(stampOn(page, FIRST_PAGE_DATE)).toBeVisible();
    await expect(continuedHeading(page)).toHaveCount(0);
  });

  test("an anchor from another locality is ignored", async ({ page }) => {
    // The impression exists, but not in the locality the route asked for.
    await seedSampleCollection(page);
    await page.goto("/passport/sg/singapore?stamp=collection-ginza-itoya-main-store");

    await expect
      .poll(async () => (await bookState(page)).pages.join(" "), { timeout: 5000 })
      .toContain("Singapore");
  });

});

/*
 * Outside the describe above, because its `beforeEach` already arranges Book mode
 * and `seedPassportView` writes only when the key is absent.
 */
test("List mode shows every impression of a locality, on one page or six", async ({
  page,
}) => {
  await useNormalMode(page);
  await seedPagedLocality(page);
  await seedPassportView(page, { mode: "list" });
  await page.goto(
    `/passport/${PAGED_LOCALITY.countryCode.toLowerCase()}/${PAGED_LOCALITY.slug}`,
  );

  await expect(
    page.getByRole("heading", { level: 1, name: PAGED_LOCALITY.name }),
  ).toBeVisible();

  // List has no pages, so a locality that spans two of them in the book is
  // still one section here.
  for (const collection of pagedLocalityCollections) {
    await expect(
      page.getByRole("button", { name: new RegExp(collection.collectedOn) }).first(),
    ).toBeVisible();
  }
});

/* ---------------------------------------------------------------------- */
/* Two tabs on one record                                                 */
/* ---------------------------------------------------------------------- */

test("a stale tab cannot erase what another tab recorded", async ({ page }) => {
  await useNormalMode(page);
  await seedSampleCollection(page);
  await page.goto("/passport");
  await expect(toggle(page)).toBeVisible();

  /*
   * Another tab opens the cover and records a scroll offset. Written straight
   * into storage because a tab never receives its own `storage` event — which is
   * exactly the state a tab that missed the notification is in. Neither field is
   * one the click below owns.
   */
  await page.evaluate(
    ([key, value]) => window.localStorage.setItem(key as string, value as string),
    [
      PASSPORT_VIEW_STORAGE_KEYS.normal,
      JSON.stringify({
        mode: null,
        coverSeen: true,
        place: null,
        listScrollTop: 750,
      }),
    ],
  );

  // Now this tab records something else entirely.
  await modeButton(page, "Book").click();
  await expect
    .poll(async () => (await storedView(page))?.mode, { timeout: 5000 })
    .toBe("book");

  const after = await storedView(page);

  expect(after?.coverSeen).toBe(true);
  expect(after?.listScrollTop).toBe(750);
});

test("two tabs keep one record between them", async ({ page }) => {
  const context = page.context();

  // Seeded on the context, so both tabs open with the same device state.
  await context.addInitScript(
    ([reviewerKey, collectionKey, collectionValue]) => {
      try {
        window.localStorage.setItem(reviewerKey as string, "0");
        window.localStorage.setItem(collectionKey as string, collectionValue as string);
      } catch {
        // A browser with storage blocked still runs the journey.
      }
    },
    [
      REVIEWER_STORAGE_KEY,
      COLLECTION_STORAGE_KEYS.normal,
      JSON.stringify({ savedShopIds: [], collections: pagedLocalityCollections }),
    ],
  );

  const tabA = await context.newPage();
  const tabB = await context.newPage();

  await tabA.goto("/passport");
  await tabB.goto("/passport");
  await expect(toggle(tabA)).toBeVisible();
  await expect(toggle(tabB)).toBeVisible();

  // Both start in List, because neither has chosen.
  expect(await selectedMode(tabA)).toBe("List");
  expect(await selectedMode(tabB)).toBe("List");

  // Tab B records a scroll offset.
  await tabB.evaluate(() => window.scrollTo({ top: 300 }));
  await expect
    .poll(async () => (await storedView(tabB))?.listScrollTop ?? 0, { timeout: 5000 })
    .toBeGreaterThan(0);

  const offset = ((await storedView(tabB))?.listScrollTop ?? 0) as number;

  // Tab A chooses Book. Tab B adopts it without being reloaded.
  await modeButton(tabA, "Book").click();
  await expect
    .poll(async () => selectedMode(tabB), { timeout: 5000 })
    .toBe("Book");

  // Tab B opens the cover. That is a durable fact about the device.
  await tabB.getByRole("button", { name: /open passport/i }).click();
  await expect
    .poll(async () => (await storedView(tabB))?.coverSeen, { timeout: 5000 })
    .toBe(true);

  // Nothing either tab did erased the other's work.
  const record = await storedView(tabA);

  expect(record?.mode).toBe("book");
  expect(record?.coverSeen).toBe(true);
  expect(record?.listScrollTop).toBe(offset);

  // And tab A, reloaded, is in Book mode with the cover behind it.
  await tabA.reload();
  await expect(toggle(tabA)).toBeVisible();
  expect(await selectedMode(tabA)).toBe("Book");
  await expect(tabA.getByRole("button", { name: /open passport/i })).toHaveCount(0);

  await tabA.close();
  await tabB.close();
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
/* Derived seals                                                          */
/* ---------------------------------------------------------------------- */

/**
 * A seal is artwork, and artwork you can open.
 *
 * The founder's WP3 staging review found country seals rendered as artwork
 * nobody could touch and locality seals reduced to a line of text. Both are now
 * the same interaction as a shop stamp, in the same overlay, with content
 * appropriate to what they are: a seal is *derived* from visits, so it never
 * offers a shop.
 */
test.describe("derived seals", () => {
  const COUNTRY_SEAL = /^Country seal, Singapore, earned 2026-06-03$/;
  const LOCALITY_SEAL = /^Locality seal, Chūō, Tokyo, earned 2026-03-14$/;

  test.beforeEach(async ({ page }) => {
    await useNormalMode(page);
    await seedSampleCollection(page);
  });

  /** Asserts what every seal overlay owes the reader, and what it must not have. */
  async function expectSealOverlay(page: Page, scope: "Country" | "Locality") {
    const dialog = page.getByRole("dialog");

    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAttribute("aria-modal", "true");
    await expect(dialog).toHaveAttribute("data-detail-kind", "seal");
    await expect(dialog.getByText(`${scope} seal`, { exact: true })).toBeVisible();

    // Derived from visits, so there is no shop to go on to and no collection
    // date to report.
    await expect(dialog.getByRole("link", { name: /open shop/i })).toHaveCount(0);
    await expect(dialog.getByText("Collected", { exact: true })).toHaveCount(0);
    await expect(dialog.getByText("Earned", { exact: true })).toBeVisible();

    return dialog;
  }

  test("List shows a country seal as artwork, and opens it", async ({ page }) => {
    await page.goto("/passport");

    const seal = page.getByRole("button", { name: COUNTRY_SEAL });

    // Artwork, not a filled alert-style chip.
    await expect(seal).toBeVisible();
    await expect(seal.locator("svg")).toBeVisible();

    // Three countries are visited and only one seal is earned; nothing stands in
    // for the other two.
    await expect(page.getByRole("button", { name: /^Country seal,/ })).toHaveCount(1);

    await seal.focus();
    await page.keyboard.press("Enter");

    const dialog = await expectSealOverlay(page, "Country");
    await expect(dialog).toHaveAccessibleName("Singapore");

    const facts = dialog.getByRole("definition");
    await expect(facts).toHaveCount(2);
    await expect(facts.nth(0)).toHaveText("Singapore");
    await expect(facts.nth(1)).toHaveText("2026-06-03");

    // Focus is contained, Escape closes, and focus comes back to the seal.
    await page.keyboard.press("Tab");
    expect(
      await page.evaluate(
        () => document.querySelector('[role="dialog"]')?.contains(document.activeElement) ?? false,
      ),
    ).toBe(true);

    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect(
      await page.evaluate(() => document.activeElement?.getAttribute("data-seal-scope")),
    ).toBe("country");
  });

  test("List shows every locality seal as artwork, and opens one", async ({ page }) => {
    await page.goto("/passport");

    // Five localities are collected, so five locality seals derive.
    await expect(page.getByRole("button", { name: /^Locality seal,/ })).toHaveCount(5);

    const seal = page.getByRole("button", { name: LOCALITY_SEAL });
    await seal.click();

    const dialog = await expectSealOverlay(page, "Locality");
    await expect(dialog).toHaveAccessibleName("Chūō, Tokyo");

    const facts = dialog.getByRole("definition");
    await expect(facts).toHaveCount(3);
    await expect(facts.nth(0)).toHaveText("Chūō, Tokyo");
    await expect(facts.nth(1)).toHaveText("Japan");
    await expect(facts.nth(2)).toHaveText("2026-03-14");

    // The obvious close control, and focus back where it came from.
    await page.getByRole("button", { name: /close seal/i }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  test("Book opens a country seal from the geographic-seals page", async ({ page }) => {
    await seedPassportView(page, {
      mode: "book",
      coverSeen: true,
      place: { kind: "seals" },
    });
    await page.goto("/passport");
    await expect
      .poll(async () => (await bookState(page)).opened, { timeout: 5000 })
      .toBe(true);
    await expect(page.getByText(/Geographic seals/i)).toBeVisible();

    await page.getByRole("button", { name: COUNTRY_SEAL }).click();
    await expectSealOverlay(page, "Country");
  });

  test("Book shows the locality seal as artwork, not as a line of text", async ({
    page,
  }) => {
    await seedPassportView(page, { mode: "book", coverSeen: true });
    await openBook(page, "/passport/jp/chuo-tokyo");

    // The WP3 text-only treatment is gone.
    await expect(page.getByText(/^Locality seal earned/)).toHaveCount(0);

    const seal = page.getByRole("button", { name: LOCALITY_SEAL });
    await expect(seal).toBeVisible();

    const before = await page.getByTestId("passport-pager").innerText();

    await seal.click();
    await expectSealOverlay(page, "Locality");

    // Pressing a seal enlarges it; it never starts a page turn.
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect(await page.getByTestId("passport-pager").innerText()).toBe(before);
  });

  test("a shop stamp still opens its own overlay, unchanged", async ({ page }) => {
    await page.goto("/passport");

    await page
      .getByRole("button", { name: /Ginza Itoya Main Store/ })
      .first()
      .click();

    const dialog = page.getByRole("dialog");

    await expect(dialog).toHaveAttribute("data-detail-kind", "impression");
    await expect(dialog.getByText("Shop stamp", { exact: true })).toBeVisible();
    await expect(dialog.getByText("Collected", { exact: true })).toBeVisible();
    await expect(dialog.getByRole("link", { name: /open shop/i })).toBeVisible();
  });
});

/* ---------------------------------------------------------------------- */
/* The way in and out of the book                                         */
/* ---------------------------------------------------------------------- */

test.describe("one control for the cover", () => {
  test.beforeEach(async ({ page }) => {
    await useNormalMode(page);
    await seedSampleCollection(page);
    await seedPassportView(page, { mode: "book" });
  });

  test("the closed book has one Open control, and it is in the pager", async ({
    page,
  }) => {
    await page.goto("/passport");

    const opener = page.getByRole("button", { name: /open passport/i });

    // One, not two: the floating opener that sat partly behind the pager pill at
    // 360 px is gone.
    await expect(opener).toHaveCount(1);
    await expect(opener).toHaveText("Open");

    // In the strip, next to Contents and the page label.
    const pager = page.getByRole("group", { name: "Passport pages" });

    await expect(pager.getByRole("button", { name: /open passport/i })).toHaveCount(1);
    await expect(pager.getByRole("button", { name: /^contents$/i })).toBeVisible();
    await expect(pager.getByTestId("passport-pager")).toBeVisible();
  });

  test("the open book exposes Cover through that same control", async ({ page }) => {
    await page.goto("/passport");

    const opener = page.getByRole("button", { name: /open passport/i });
    const position = await opener.evaluate(
      (node) => [...(node.parentElement?.children ?? [])].indexOf(node),
    );

    await opener.click();
    await expect
      .poll(async () => (await bookState(page)).opened, { timeout: 5000 })
      .toBe(true);

    const cover = page.getByRole("button", { name: /^cover$/i });

    await expect(cover).toHaveCount(1);
    await expect(page.getByRole("button", { name: /open passport/i })).toHaveCount(0);
    expect(
      await cover.evaluate((node) => [...(node.parentElement?.children ?? [])].indexOf(node)),
    ).toBe(position);

    // And it takes the reader back, where the control offers Open again.
    await cover.click();
    await expect
      .poll(async () => (await bookState(page)).opened, { timeout: 5000 })
      .toBe(false);
    await expect(page.getByRole("button", { name: /open passport/i })).toBeVisible();
  });

  test("the pager fits and works at 360 x 800", async ({ page, viewport }) => {
    test.skip((viewport?.width ?? 0) !== 360, "The width the overlap was found at.");

    await page.goto("/passport");
    await expect(page.getByRole("button", { name: /open passport/i })).toBeVisible();

    // Nothing overflows the document sideways.
    expect(
      await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth: window.innerWidth,
      })),
    ).toEqual({ scrollWidth: 360, innerWidth: 360 });

    // Every control in the strip is fully inside the viewport and has a real
    // tap target.
    const boxes = await page
      .getByRole("group", { name: "Passport pages" })
      .evaluate((pager) =>
        [...pager.querySelectorAll("button")].map((button) => {
          const rect = button.getBoundingClientRect();

          return {
            left: Math.round(rect.left),
            right: Math.round(rect.right),
            width: Math.round(rect.width),
            height: Math.round(rect.height),
          };
        }),
      );

    expect(boxes.length).toBeGreaterThanOrEqual(4);

    for (const box of boxes) {
      expect(box.left).toBeGreaterThanOrEqual(0);
      expect(box.right).toBeLessThanOrEqual(360);
      expect(box.width).toBeGreaterThan(0);
      expect(box.height).toBeGreaterThanOrEqual(24);
    }

    // And the control still does its job at this width.
    await page.getByRole("button", { name: /open passport/i }).click();
    await expect
      .poll(async () => (await bookState(page)).opened, { timeout: 5000 })
      .toBe(true);
  });
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

    // By the shop's name: the Chūō, Tokyo locality seal was earned on the same
    // day, so a date alone no longer identifies a stamp row.
    const row = page.getByRole("button", { name: /Ginza Itoya Main Store/ }).first();
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
    await page.getByRole("button", { name: /Ginza Itoya Main Store/ }).first().click();

    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByRole("button", { name: /close stamp/i }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  test("opens from a Book page too", async ({ page }) => {
    await seedPassportView(page, { mode: "book", coverSeen: true });
    await openBook(page);

    await page.getByRole("button", { name: /Fook Hing Trading/ }).first().click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByRole("heading", { name: /fook hing trading/i }),
    ).toBeVisible();
  });

  test("Open shop keeps the Passport route it was opened from", async ({ page }) => {
    await page.goto("/passport/jp/chuo-tokyo");

    await page.getByRole("button", { name: /Ginza Itoya Main Store/ }).first().click();
    await page.getByRole("link", { name: /open shop/i }).click();

    await expect(page).toHaveURL(/\/shops\/ginza-itoya-main-store/);

    const back = page.getByRole("link", { name: /back to passport/i });
    // The route, plus the page inside it that the impression sits on.
    await expect(back).toHaveAttribute(
      "href",
      "/passport/jp/chuo-tokyo?stamp=collection-ginza-itoya-main-store",
    );
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

  await page.getByRole("button", { name: /Fook Hing Trading/ }).first().click();
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

  // The locality route, carrying the impression that was just pressed so a
  // locality already spanning several pages opens on the right one.
  await expect(page).toHaveURL(
    /\/passport\/tw\/daan-taipei\?stamp=collection-ty-lee-pen-shop$/,
  );
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

  /*
   * The name comes from the account, which is now a real session rather than
   * the reviewer preview these two tests were written against. A normal device
   * with a session is the ordinary case, so the collection is seeded here
   * instead of relying on the reviewer store's baseline.
   */
  test("shows a display name when the account has one", async ({ page }) => {
    await stubSession(page, { kind: "signed-in", displayName: "Ada Lovelace" });
    await seedSampleCollection(page);
    await seedPassportView(page, { mode: "book", coverSeen: true });
    await openIdentity(page);

    await expect(page.getByRole("heading", { name: "Ada Lovelace" })).toBeVisible();
  });

  /* And with no display name chosen, the account's address stays out of the
     Passport entirely: the front matter is not a place to print an identity. */
  test("falls back to Your Passport, and never to an address", async ({ page }) => {
    await stubSession(page, { kind: "signed-in" });
    await seedSampleCollection(page);
    await seedPassportView(page, { mode: "book", coverSeen: true });
    await openIdentity(page);

    await expect(page.getByRole("heading", { name: "Your Passport" })).toBeVisible();
    await expect(page.getByText(SESSION_IDENTITY)).toHaveCount(0);
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
    await page.getByRole("button", { name: /Ginza Itoya Main Store/ }).first().click();
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
