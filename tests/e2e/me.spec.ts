import { expect, test, type Page } from "@playwright/test";

import {
  ACCOUNT_PREVIEW_STORAGE_KEY,
  COLLECTION_STORAGE_KEYS,
  seedOrphanedSignedInPreview,
  seedSampleCollection,
  seedSignedInPreview,
  useReviewerMode,
} from "../support/local-state";

/**
 * Me after the WP2 restructure.
 *
 * The journeys are about structure and consequence: which groups a reader gets,
 * where Places visited takes them, what the local-data controls actually do, and
 * the one property the account seam exists for — that a normal-mode device can
 * never be put into the signed-in state.
 */
/**
 * Each row's result is its own named live region, and a sibling of the button
 * rather than a descendant — a live region nested in a button is flattened into
 * that button's accessible name and never announced.
 */
function clearResult(page: Page) {
  return page.getByRole("status", { name: /clear data on this device result/i });
}

function downloadResult(page: Page) {
  return page.getByRole("status", { name: /download local data result/i });
}

test.describe("signed out", () => {
  test("offers an account, and locates the reader's data on the device", async ({
    page,
  }) => {
    await page.goto("/me");

    const account = page.getByRole("region", { name: /^account$/i });
    const device = page.getByRole("region", { name: /on this device/i });

    // Saving and collecting both work anonymously, so nothing here may claim an
    // account is required for them.
    await expect(account.getByText("Sign in")).toBeVisible();
    await expect(account.getByText(/need an account/i)).toHaveCount(0);

    await expect(device).toContainText(/do not sync/i);
    await expect(device).toContainText(/clearing this browser's data clears them/i);
    await expect(
      device.getByRole("button", { name: /download local data/i }),
    ).toBeVisible();

    // Signed out there is no account to delete and no session to end.
    await expect(page.getByRole("region", { name: /^danger$/i })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /sign out/i })).toHaveCount(0);
  });

  test("routes Suggest a pen shop to the contribution mailbox", async ({ page }) => {
    await page.goto("/me");

    const contribute = page.getByRole("region", { name: /contribute/i });
    const suggest = contribute.getByRole("link", { name: /suggest a pen shop/i });

    await expect(suggest).toHaveAttribute(
      "href",
      "mailto:hello@nibatlas.com?subject=%5BSuggest%20shop%5D",
    );

    // The subject tag has to arrive at the mailbox exactly as accepted decision
    // 8 writes it, so it is asserted decoded as well as encoded.
    const href = await suggest.getAttribute("href");

    expect(new URL(href!).searchParams.get("subject")).toBe("[Suggest shop]");

    // A routed entry carries no pending badge; the correction stays deferred to
    // WP7 and says so without a work-package number.
    await expect(contribute.getByText("Report incorrect information")).toBeVisible();
    await expect(contribute.getByText("Not open yet")).toHaveCount(1);
    await expect(contribute.getByText(/WP\d|Milestone \d/)).toHaveCount(0);
  });

  test("states preferences as copy, with nothing inert to press", async ({ page }) => {
    await page.goto("/me");

    const preferences = page.getByRole("region", {
      name: /preferences and accessibility/i,
    });

    await expect(preferences).toContainText(/reduced-motion setting/i);
    await expect(preferences).toContainText(/keyboard navigation with visible focus/i);
    await expect(preferences.getByRole("button")).toHaveCount(0);
    await expect(preferences.getByRole("listitem")).toHaveCount(0);
    await expect(preferences.getByText(/no in-app override|reference only/i)).toHaveCount(
      0,
    );
  });

  /*
   * The copy corrections from the Codex review, asserted so they cannot come
   * back: clearing removes two named things, it does not leave the device free
   * of Nib Atlas, it does not touch preferences, and removing the app from a
   * home screen is not stated as deleting data.
   */
  test("never overstates what the local-data controls cover", async ({ page }) => {
    await seedSampleCollection(page);
    await page.goto("/me");

    const device = page.getByRole("region", { name: /on this device/i });

    await expect(device).toContainText(/saved shops and collected impressions/i);
    await expect(device.getByText(/home screen/i)).toHaveCount(0);
    await expect(device.getByText(/preferences are stored/i)).toHaveCount(0);

    await page.getByRole("button", { name: /clear data on this device/i }).click();
    await expect(
      page.getByText(/clear your saved shops and collected impressions/i),
    ).toBeVisible();
    await page.getByRole("button", { name: /^clear this device$/i }).click();

    await expect(clearResult(page)).toContainText(/removed from this browser/i);
    await expect(page.getByText(/nothing from nib atlas/i)).toHaveCount(0);
  });

  test("omits Places visited on a device with no stamps", async ({ page }) => {
    await page.goto("/me");

    await expect(page.getByRole("region", { name: /places visited/i })).toHaveCount(0);
  });
});

test.describe("places visited", () => {
  test("counts visits from stamps and links into the Passport", async ({ page }) => {
    await seedSampleCollection(page);
    await page.goto("/me");

    const places = page.getByRole("region", { name: /places visited/i });

    // Seeded state: six stamps across three countries and five localities, but
    // only Singapore's country seal is earned. If seals stood in for visits,
    // this would read 1.
    await expect(places.locator("p", { hasText: "Countries" })).toContainText("3");
    await expect(places.locator("p", { hasText: "Localities" })).toContainText("5");
    // Exact, or "country seal" in the progress lines would match too.
    await expect(places.getByText("Seal", { exact: true })).toHaveCount(1);
    await expect(
      places.getByText(/2 of 4 curated shops collected towards the country seal/i),
    ).toHaveCount(2);

    // The coverage-set version behind that denominator is reviewer
    // instrumentation and must not appear in the product surface.
    await expect(places.getByText(/curated set [a-z]{2}-/i)).toHaveCount(0);

    await expect(places.getByRole("link", { name: /japan/i })).toHaveAttribute(
      "href",
      "/passport/jp",
    );
    await expect(places.getByRole("link", { name: /chūō, tokyo/i })).toHaveAttribute(
      "href",
      "/passport/jp/chuo-tokyo",
    );
  });

  test("a locality link opens that locality in the Passport", async ({ page }) => {
    await seedSampleCollection(page);
    await page.goto("/me");

    await page
      .getByRole("region", { name: /places visited/i })
      .getByRole("link", { name: /chūō, tokyo/i })
      .click();

    await expect(page).toHaveURL(/\/passport\/jp\/chuo-tokyo$/);
  });
});

test.describe("local data controls", () => {
  test("asks before clearing, and clears only when confirmed", async ({ page }) => {
    await seedSampleCollection(page);
    await page.goto("/me");

    const places = page.getByRole("region", { name: /places visited/i });

    await expect(places).toBeVisible();

    // A row button's accessible name is its title and detail together, so the
    // confirm button inside the panel carries a distinct label and each control
    // can be addressed by name.
    const trigger = page.getByRole("button", { name: /clear data on this device/i });

    await trigger.click();
    await expect(page.getByText(/cannot be undone/i)).toBeVisible();
    await page.getByRole("button", { name: /^cancel$/i }).click();
    await expect(places).toBeVisible();

    await trigger.click();
    await page.getByRole("button", { name: /^clear this device$/i }).click();

    await expect(clearResult(page)).toContainText(/cleared/i);
    await expect(page.getByRole("region", { name: /places visited/i })).toHaveCount(0);

    /*
     * And it stays cleared. Asserted against storage rather than by reloading:
     * the arranged state is an init script, so a reload would re-seed the very
     * collection this just removed. What matters on disk is that the store is
     * present and empty — an *absent* key is a reviewer device's cue to reseed.
     */
    const stored = await page.evaluate(
      (key) => window.localStorage.getItem(key),
      COLLECTION_STORAGE_KEYS.normal,
    );

    expect(stored).not.toBeNull();
    expect(JSON.parse(stored!)).toMatchObject({ savedShopIds: [], collections: [] });
  });

  /*
   * The reason Cancel takes focus: opening the panel and confirming it would
   * otherwise be two presses of the same key, with the question never read.
   */
  test("a destructive confirmation opens on Cancel and survives a second Enter", async ({
    page,
  }) => {
    await seedSampleCollection(page);
    await page.goto("/me");

    await page.getByRole("button", { name: /clear data on this device/i }).focus();
    await page.keyboard.press("Enter");

    await expect(page.getByRole("button", { name: /^cancel$/i })).toBeFocused();

    await page.keyboard.press("Enter");

    // Focus is back on the row, the panel is closed, and nothing was cleared.
    await expect(
      page.getByRole("button", { name: /clear data on this device/i }),
    ).toBeFocused();
    await expect(page.getByRole("region", { name: /places visited/i })).toBeVisible();
    await expect(page.getByText(/cannot be undone/i)).toHaveCount(0);
  });

  test("the destructive button is still reachable, one tab away", async ({ page }) => {
    await seedSampleCollection(page);
    await page.goto("/me");

    await page.getByRole("button", { name: /clear data on this device/i }).focus();
    await page.keyboard.press("Enter");
    await page.keyboard.press("Shift+Tab");

    await expect(page.getByRole("button", { name: /^clear this device$/i })).toBeFocused();

    await page.keyboard.press("Enter");

    await expect(clearResult(page)).toContainText(/removed from this browser/i);
    await expect(
      page.getByRole("button", { name: /clear data on this device/i }),
    ).toBeFocused();
  });

  test("announces each result outside the button that produced it", async ({
    page,
  }) => {
    await seedSampleCollection(page);
    await page.goto("/me");

    // The regions exist before they have anything to say: several screen
    // readers miss an update to a live region inserted at the same moment.
    await expect(clearResult(page)).toBeAttached();
    await expect(downloadResult(page)).toBeAttached();

    for (const result of [clearResult(page), downloadResult(page)]) {
      expect(
        await result.evaluate((node) => node.closest("button") !== null),
      ).toBe(false);
    }
  });

  /*
   * Two tabs, one clear. Tab B is holding the old collection in React state,
   * and its next write must carry the cleared state forward rather than the
   * state it was holding — otherwise the collection comes back and the
   * confirmation ("this cannot be undone") was a lie.
   */
  test("a clear in one tab is not undone by another tab", async ({ context }) => {
    const first = await context.newPage();
    const second = await context.newPage();

    // Seeded on the first page only, then the second navigates — the two share
    // the context's `localStorage`, which is the whole point of the test.
    await seedSampleCollection(first);
    await first.goto("/me");
    await second.goto("/me");

    await expect(first.getByRole("region", { name: /places visited/i })).toBeVisible();
    await expect(second.getByRole("region", { name: /places visited/i })).toBeVisible();

    await first.getByRole("button", { name: /clear data on this device/i }).click();
    await first.getByRole("button", { name: /^clear this device$/i }).click();
    await expect(clearResult(first)).toContainText(/removed from this browser/i);

    // The second tab adopts it rather than sitting on a stale collection.
    await expect(
      second.getByRole("region", { name: /places visited/i }),
    ).toHaveCount(0);

    // And a save made there afterwards does not write the old arrays back.
    await second.goto("/shops/juspirit-banqiao");
    await second.getByRole("button", { name: /^save$/i }).click();
    await expect(second.getByRole("button", { name: /^saved$/i })).toBeVisible();

    /*
     * Checked live in the first tab and against storage, not by reloading: the
     * arranged collection is an init script on that page, so a reload would
     * re-seed the very state under test.
     */
    await expect(first.getByRole("region", { name: /places visited/i })).toHaveCount(0);

    const stored = await first.evaluate(
      (key) => window.localStorage.getItem(key),
      COLLECTION_STORAGE_KEYS.normal,
    );

    expect(JSON.parse(stored!).collections).toEqual([]);

    await first.close();
    await second.close();
  });

  test("downloads a machine-readable copy of the device's own data", async ({
    page,
  }) => {
    await seedSampleCollection(page);
    await page.goto("/me");

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: /download local data/i }).click(),
    ]);

    expect(download.suggestedFilename()).toMatch(
      /^nib-atlas-data-\d{4}-\d{2}-\d{2}\.json$/,
    );

    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];

    for await (const chunk of stream) {
      chunks.push(Buffer.from(chunk));
    }

    const payload = JSON.parse(Buffer.concat(chunks).toString("utf8"));

    expect(payload.schema).toBe("nib-atlas.local-data/1");
    expect(payload.store).toBe("normal");
    expect(payload.collections).toHaveLength(6);
    // Simulated impressions have to keep saying so once they leave the app.
    expect(
      payload.collections.every((collection: { simulated: boolean }) => collection.simulated),
    ).toBe(true);
  });
});

test.describe("the signed-in structure", () => {
  /*
   * The property the account seam exists for. Authentication is Milestone 4, so
   * a tester must never be shown copy that says they have an account — whatever
   * a previous reviewer session left in storage.
   */
  test("a normal device ignores a stored signed-in preview", async ({ page }) => {
    await seedOrphanedSignedInPreview(page);
    await page.goto("/me");

    await expect(page.getByText("Sign in")).toBeVisible();
    await expect(page.getByRole("region", { name: /^danger$/i })).toHaveCount(0);
    await expect(page.getByText("Ada")).toHaveCount(0);
  });

  test("reviewer mode can preview it, labelled as a preview", async ({ page }) => {
    await seedSignedInPreview(page);
    await page.goto("/me");

    const account = page.getByRole("region", { name: /^account$/i });

    await expect(account.getByText(/reviewer preview/i)).toBeVisible();
    await expect(account.getByText("reviewer@nibatlas.example").first()).toBeVisible();
    await expect(page.getByLabel(/display name/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /sign out/i })).toBeVisible();

    const danger = page.getByRole("region", { name: /^danger$/i });

    await expect(danger.getByText("Delete account")).toBeVisible();
  });

  test("a display name replaces the account address", async ({ page }) => {
    await seedSignedInPreview(page);
    await page.goto("/me");

    await page.getByLabel(/display name/i).fill("Ada Lovelace");
    await page.getByRole("button", { name: /^save$/i }).click();

    await expect(
      page.getByRole("region", { name: /^account$/i }).getByRole("status"),
    ).toContainText(/display name saved/i);
    await expect(
      page.getByRole("region", { name: /^account$/i }).getByText("Ada Lovelace"),
    ).toBeVisible();

    // Persisted on the device, checked in storage for the same reason as above.
    const stored = await page.evaluate(
      (key) => window.localStorage.getItem(key),
      ACCOUNT_PREVIEW_STORAGE_KEY,
    );

    expect(JSON.parse(stored!)).toMatchObject({
      signedIn: true,
      displayName: "Ada Lovelace",
    });
  });

  test("deleting the account asks first", async ({ page }) => {
    await seedSignedInPreview(page);
    await page.goto("/me");

    await page.getByRole("button", { name: /delete account/i }).click();

    await expect(page.getByText(/delete your nib atlas account\?/i)).toBeVisible();
    await expect(page.getByText(/removed permanently/i)).toBeVisible();

    await page.getByRole("button", { name: /^cancel$/i }).click();

    await expect(page.getByRole("region", { name: /^danger$/i })).toBeVisible();
  });

  test("signing out returns the reviewer to the signed-out structure", async ({
    page,
  }) => {
    await seedSignedInPreview(page);
    await page.goto("/me");

    await page.getByRole("button", { name: /sign out/i }).click();

    await expect(page.getByText("Sign in")).toBeVisible();
    await expect(page.getByRole("region", { name: /^danger$/i })).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: /preview the signed-in account/i }),
    ).toBeVisible();
  });
});

test("reviewer mode keeps the milestone wording on the sign-in row", async ({
  page,
}) => {
  await useReviewerMode(page);
  await page.goto("/me");

  await expect(page.getByText("Sign-in and sync arrive in Milestone 4")).toBeVisible();
});

test("the pending badge keeps the row text readable at 360 px", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/me");

  const detail = page.getByText(
    /An account carries your saved shops and collected impressions between devices/i,
  );
  const badge = page.getByText("Not available yet").first();

  const detailBox = await detail.boundingBox();
  const badgeBox = await badge.boundingBox();

  expect(detailBox).not.toBeNull();
  expect(badgeBox).not.toBeNull();

  // The badge sits below the text rather than beside it, so the detail keeps the
  // full column width.
  expect(badgeBox!.y).toBeGreaterThanOrEqual(detailBox!.y + detailBox!.height - 1);
  expect(detailBox!.width).toBeGreaterThan(240);
});
