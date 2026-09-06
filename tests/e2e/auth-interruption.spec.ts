import { expect, test, type Page } from "@playwright/test";

import {
  SESSION_IDENTITY,
  stubGoogle,
  stubMagicLink,
  stubSession,
} from "../support/auth";

/**
 * Authentication as an interruption.
 *
 * `UX.md` — *Authentication and interruption* — asks for four things, and this
 * file is about each of them: authentication is not the beginning of the
 * product, it preserves where the reader was and what they were doing, it
 * finishes a Save afterwards, and it never asks for location on the way back.
 *
 * WP3 built the interruption and carried the pending intent; WP4 supplied the
 * private saved-shop service. WP5 now connects a deliberate new Save to that
 * interruption while leaving ordinary discovery anonymous. These journeys
 * prove that boundary, that the interruption can be declined, and that the
 * return path and pending intent reach the server intact for the follow-up
 * completion slice.
 *
 * Every case says which session answer it arranges. The build under test has no
 * Supabase project behind it, so an unarranged session is the "no accounts in
 * this build" state — which is its own journey, in `me.spec.ts`.
 */
const SHOP_ID = "9f1b6c3a-2d4e-4f8a-9c1b-5e7d2a3f4b60";

function interruption(page: Page) {
  return page.getByRole("dialog", { name: /sign in to nib atlas/i });
}

async function openFromMe(page: Page) {
  await page.goto("/me");
  await page
    .getByRole("region", { name: /^account$/i })
    .getByRole("button", { name: /sign in/i })
    .click();

  const dialog = interruption(page);

  await expect(dialog).toBeVisible();

  return dialog;
}

test.describe("anonymous discovery", () => {
  /*
   * The invariant the whole milestone is bounded by. A signed-out reader can
   * explore and search without interruption. A deliberate new Save is the
   * account action: it opens in context and does not mutate device state while
   * the reader decides.
   */
  test("is not interrupted until a persistent Save is requested", async ({
    page,
  }) => {
    await stubSession(page, { kind: "signed-out" });
    await page.goto("/");

    await expect(
      page.getByRole("list", { name: /shops in the searched area/i }),
    ).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(0);

    await page.goto("/shops/ginza-itoya-main-store");
    const save = page.getByRole("button", { name: "Save shop" });

    await save.click();

    const dialog = interruption(page);

    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText(/Save Ginza Itoya Main Store/i);
    await expect(save).toHaveAttribute("aria-pressed", "false");

    await dialog.getByRole("button", { name: /not now/i }).click();

    await expect(dialog).toHaveCount(0);
    await expect(save).toHaveAttribute("aria-pressed", "false");
  });
});

test.describe("the interruption", () => {
  test("offers both ways in, and can be declined", async ({ page }) => {
    await stubSession(page, { kind: "signed-out" });

    const dialog = await openFromMe(page);

    await expect(
      dialog.getByRole("button", { name: /continue with google/i }),
    ).toBeVisible();
    await expect(dialog.getByLabel(/email address/i)).toBeVisible();
    await expect(dialog).toContainText(/work without an account/i);

    await dialog.getByRole("button", { name: /not now/i }).click();

    await expect(interruption(page)).toHaveCount(0);
    // Declining leaves the reader exactly where they were, still signed out.
    await expect(
      page.getByRole("region", { name: /^account$/i }).getByRole("button", {
        name: /sign in/i,
      }),
    ).toBeFocused();
  });

  test("closes on Escape and returns focus to the control that opened it", async ({
    page,
  }) => {
    await stubSession(page, { kind: "signed-out" });
    await openFromMe(page);

    await page.keyboard.press("Escape");

    await expect(interruption(page)).toHaveCount(0);
    await expect(
      page.getByRole("region", { name: /^account$/i }).getByRole("button", {
        name: /sign in/i,
      }),
    ).toBeFocused();
  });

  /* Tab cycles inside a modal dialog and never reaches the page behind it. */
  test("keeps keyboard focus inside itself", async ({ page }) => {
    await stubSession(page, { kind: "signed-out" });

    const dialog = await openFromMe(page);

    for (let press = 0; press < 12; press += 1) {
      await page.keyboard.press("Tab");
      expect(
        await page.evaluate(() => {
          const active = document.activeElement;
          const dialogElement = document.querySelector('[role="dialog"]');

          return Boolean(
            active && dialogElement && (dialogElement.contains(active) || active === dialogElement),
          );
        }),
      ).toBe(true);
    }

    await expect(dialog).toBeVisible();
  });

  test("sends a link and says where it went without naming an unconfigured sender", async ({
    page,
  }) => {
    await stubSession(page, { kind: "signed-out" });
    const posted = await stubMagicLink(page);

    const dialog = await openFromMe(page);

    await dialog.getByLabel(/email address/i).fill("ada@example.com");
    await dialog.getByRole("button", { name: /email me a sign-in link/i }).click();

    const confirmation = page.getByRole("dialog", { name: /check your email/i });

    await expect(confirmation).toContainText("ada@example.com");
    await expect(confirmation).toContainText(/Nib Atlas sign-in message/i);
    await expect(confirmation).not.toContainText("login@nibatlas.com");
    // Nothing here says whether the address already had an account: the route
    // answers the same way either way, and the copy keeps it that way.
    await expect(confirmation).not.toContainText(/welcome back|new account/i);

    expect(posted.bodies).toHaveLength(1);
    expect(posted.bodies[0]).toMatchObject({
      email: "ada@example.com",
      returnTo: "/me#me-account",
      intent: null,
    });
  });

  test("says what to do when too many links have been asked for", async ({ page }) => {
    await stubSession(page, { kind: "signed-out" });
    await stubMagicLink(page, {
      kind: "error",
      status: 429,
      code: "magic_link_unavailable",
    });

    const dialog = await openFromMe(page);

    await dialog.getByLabel(/email address/i).fill("ada@example.com");
    await dialog.getByRole("button", { name: /email me a sign-in link/i }).click();

    await expect(
      page.getByRole("alert", { name: /sign-in error/i }),
    ).toContainText(/wait a few minutes/i);
    // The form is still there to try with, which is the point of saying so.
    await expect(dialog.getByLabel(/email address/i)).toBeEditable();
  });

  /*
   * Google is a top-level navigation, not a fetch: the route returns the
   * provider URL and the browser leaves. The stub stands in for Supabase's
   * authorize endpoint with a same-origin page, so the navigation itself is
   * observable — what is under test is that it happens, and to what the route
   * returned.
   */
  test("hands Google's URL to the browser as a navigation", async ({ page, baseURL }) => {
    await stubSession(page, { kind: "signed-out" });
    const posted = await stubGoogle(page, {
      kind: "redirect",
      to: `${baseURL}/about?stub=provider`,
    });

    const dialog = await openFromMe(page);

    await dialog.getByRole("button", { name: /continue with google/i }).click();

    await expect(page).toHaveURL(/\/about\?stub=provider$/);
    expect(posted.bodies[0]).toMatchObject({ returnTo: "/me#me-account" });
  });

  test("reports a provider that could not be reached, without leaving", async ({
    page,
  }) => {
    await stubSession(page, { kind: "signed-out" });
    await stubGoogle(page, { kind: "error", status: 502, code: "google_unavailable" });

    const dialog = await openFromMe(page);

    await dialog.getByRole("button", { name: /continue with google/i }).click();

    await expect(
      page.getByRole("alert", { name: /sign-in error/i }),
    ).toContainText(/not responding just now/i);
    await expect(page).toHaveURL(/\/me$/);
    await expect(
      dialog.getByRole("button", { name: /continue with google/i }),
    ).toBeEnabled();
  });
});

test.describe("/login", () => {
  test("starts the flow as a route, for a link that has to land somewhere", async ({
    page,
  }) => {
    await stubSession(page, { kind: "signed-out" });
    const posted = await stubMagicLink(page);

    await page.goto("/login?returnTo=%2Fshops%2Fginza-itoya-main-store");

    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Sign in to Nib Atlas",
    );

    await page.getByLabel(/email address/i).fill("ada@example.com");
    await page.getByRole("button", { name: /email me a sign-in link/i }).click();

    await expect(
      page.getByRole("status", { name: /sign-in link/i }),
    ).toContainText("ada@example.com");
    expect(posted.bodies[0]).toMatchObject({
      returnTo: "/shops/ginza-itoya-main-store",
    });
  });

  /*
   * The pending Save intent, carried into the flow. Completing it after
   * authentication is WP5's work — the server holds it in its own cookie — so
   * what is asserted here is that it reaches the route unchanged and that the
   * panel says what returning will do without claiming the save has happened.
   */
  test("carries a pending Save intent to the server", async ({ page }) => {
    await stubSession(page, { kind: "signed-out" });
    const posted = await stubMagicLink(page);

    await page.goto(
      `/login?returnTo=%2Fshops%2Fginza-itoya-main-store&intent=save-shop&shopId=${SHOP_ID}`,
    );

    await expect(page.getByText(/you were saving a shop/i)).toBeVisible();
    await expect(page.getByText(/saved to your account/i)).toHaveCount(0);

    await page.getByLabel(/email address/i).fill("ada@example.com");
    await page.getByRole("button", { name: /email me a sign-in link/i }).click();

    await expect(page.getByRole("status", { name: /sign-in link/i })).toBeVisible();
    expect(posted.bodies[0]).toMatchObject({
      returnTo: "/shops/ginza-itoya-main-store",
      intent: { type: "save-shop", shopId: SHOP_ID },
    });
  });

  /* A collect intent returns to the shop, and says location is asked for there. */
  test("carries a pending Collect intent without promising location", async ({
    page,
  }) => {
    await stubSession(page, { kind: "signed-out" });
    const posted = await stubMagicLink(page);

    await page.goto(
      "/login?returnTo=%2Fshops%2Fty-lee-pen-shop&intent=collect-shop&shopSlug=ty-lee-pen-shop",
    );

    await expect(page.getByText(/never during sign-in/i)).toBeVisible();

    await page.getByLabel(/email address/i).fill("ada@example.com");
    await page.getByRole("button", { name: /email me a sign-in link/i }).click();

    await expect(page.getByRole("status", { name: /sign-in link/i })).toBeVisible();
    expect(posted.bodies[0]).toMatchObject({
      intent: { type: "collect-shop", shopSlug: "ty-lee-pen-shop" },
    });
  });

  /*
   * `returnTo` is an open-redirect surface. The server validates it again when
   * a flow starts; this is the interface refusing to offer the reader a link it
   * would not honour.
   */
  test("refuses a return path outside the application", async ({ page }) => {
    await stubSession(page, { kind: "signed-in" });

    await page.goto("/login?returnTo=https%3A%2F%2Felsewhere.example%2F");

    const carryOn = page.getByRole("link", { name: /continue/i });

    await expect(carryOn).toHaveAttribute("href", "/me#me-account");
  });

  test("tells a signed-in reader there is nothing to do here", async ({ page }) => {
    await stubSession(page, { kind: "signed-in" });

    await page.goto("/login?returnTo=%2Fpassport");

    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "You are already signed in",
    );
    await expect(page.getByText(SESSION_IDENTITY)).toBeVisible();
    await expect(page.getByRole("link", { name: /continue/i })).toHaveAttribute(
      "href",
      "/passport",
    );
  });

  test("says plainly when the build has no accounts behind it", async ({ page }) => {
    await page.goto("/login");

    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Signing in is unavailable",
    );
    await expect(page.getByText(/no accounts behind it/i)).toBeVisible();
    await expect(page.getByRole("link", { name: /back to the map/i })).toBeVisible();
  });
});

test.describe("coming back from the callback", () => {
  /*
   * The callback is a route handler: it cannot render, so it redirects to the
   * reader's own return path with its result in the query. The map is the
   * hardest case — the result has to be announced over it, the selected shop
   * has to survive, and the parameter has to be gone by the time the reader
   * looks at the address bar.
   */
  test("announces a completed sign-in and keeps the map context", async ({ page }) => {
    await stubSession(page, { kind: "signed-in" });

    await page.goto("/?shop=ginza-itoya-main-store&auth=success");

    const banner = page.getByRole("status", { name: /sign-in result/i });

    await expect(banner).toContainText(/you are signed in/i);
    await expect(page.getByText("Selected: Ginza Itoya Main Store")).toBeVisible();

    await expect
      .poll(() => new URL(page.url()).search)
      .toBe("?shop=ginza-itoya-main-store");

    // Dismissing it leaves the reader on the same map, signed in.
    await page.getByRole("button", { name: /dismiss this message/i }).click();
    await expect(banner).toHaveCount(0);
    await expect(page.getByText("Selected: Ginza Itoya Main Store")).toBeVisible();
  });

  test("restores committed map filters carried through a new auth tab", async ({
    page,
  }) => {
    await stubSession(page, { kind: "signed-in" });
    const mapContext = JSON.stringify({
      viewport: {
        bounds: { west: 138.9, south: 35.4, east: 140.1, north: 36 },
        zoom: 10,
      },
      label: "Tokyo",
      filters: {
        status: "all",
        shopTypes: ["stationery_store"],
        availability: "not_closed",
      },
    });

    await page.goto(
      `/?shop=ginza-itoya-main-store&mapContext=${encodeURIComponent(mapContext)}&auth=success`,
    );

    await expect(page.getByText("Selected: Ginza Itoya Main Store")).toBeVisible();
    const sheetHandle = page.getByRole("button", { name: /results sheet, peek/i });

    if ((await sheetHandle.count()) > 0) {
      await sheetHandle.click();
    }

    await expect(page.getByRole("button", { name: /filters 2 filters applied/i })).toBeVisible();

    await page.getByRole("button", { name: /filters 2 filters applied/i }).click();
    const filters = page.getByRole("dialog", { name: "Filters" });

    await expect(
      filters.getByRole("button", { name: "Stationery store" }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(
      filters.getByRole("button", { name: "Hide recorded closures" }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect
      .poll(() => new URL(page.url()).searchParams.has("auth"))
      .toBe(false);
  });

  test("offers another attempt when the link had expired", async ({ page }) => {
    await stubSession(page, { kind: "signed-out" });
    await stubMagicLink(page);

    await page.goto("/shops/ginza-itoya-main-store?authError=expired_link");

    const alert = page.getByRole("alert", { name: /sign-in result/i });

    await expect(alert).toContainText(/that sign-in link has expired/i);
    await expect.poll(() => new URL(page.url()).search).toBe("");

    await alert.getByRole("button", { name: /try again/i }).click();

    const dialog = interruption(page);

    await expect(dialog).toBeVisible();

    // The second attempt returns to the page the first one was started from.
    await dialog.getByLabel(/email address/i).fill("ada@example.com");
    await dialog.getByRole("button", { name: /email me a sign-in link/i }).click();
    await expect(page.getByRole("dialog", { name: /check your email/i })).toBeVisible();
  });

  /*
   * The retry picks up the flow that failed, intent included.
   *
   * The callback clears the server's continuation on its way back, so a retry
   * that started a blank flow would post `intent: null` — and the Save the
   * interruption was opened for could then never complete, however many times
   * the reader signed in. What the tab remembers is re-sent, and the server
   * validates it again exactly as it validated the first one.
   */
  test("carries the interrupted action into a retry", async ({ page }) => {
    await stubSession(page, { kind: "signed-out" });
    const posted = await stubMagicLink(page);

    await page.goto(
      `/login?returnTo=%2Fshops%2Fginza-itoya-main-store&intent=save-shop&shopId=${SHOP_ID}`,
    );
    await page.getByLabel(/email address/i).fill("ada@example.com");
    await page.getByRole("button", { name: /email me a sign-in link/i }).click();
    await expect(page.getByRole("status", { name: /sign-in link/i })).toBeVisible();

    // The link expired, so the callback returns the reader to the shop with
    // nothing of the flow left on the server.
    await page.goto("/shops/ginza-itoya-main-store?authError=expired_link");

    const alert = page.getByRole("alert", { name: /sign-in result/i });

    await expect(alert).toContainText(/expired/i);
    await alert.getByRole("button", { name: /try again/i }).click();

    const dialog = interruption(page);

    await expect(dialog).toContainText(/you were saving a shop/i);

    await dialog.getByLabel(/email address/i).fill("ada@example.com");
    await dialog.getByRole("button", { name: /email me a sign-in link/i }).click();
    await expect(page.getByRole("dialog", { name: /check your email/i })).toBeVisible();

    expect(posted.bodies.at(-1)).toMatchObject({
      returnTo: "/shops/ginza-itoya-main-store",
      intent: { type: "save-shop", shopId: SHOP_ID },
    });
  });

  test("says a cancelled Google sign-in changed nothing", async ({ page }) => {
    await stubSession(page, { kind: "signed-out" });

    await page.goto("/me?authError=provider_denied");

    await expect(
      page.getByRole("alert", { name: /sign-in result/i }),
    ).toContainText(/still signed out/i);
    await expect(
      page.getByRole("region", { name: /^account$/i }).getByRole("button", {
        name: /sign in/i,
      }),
    ).toBeVisible();
  });

  /*
   * Location is never requested on the way back in.
   *
   * `UX.md` is explicit about it, and the reason is the reader's: a permission
   * prompt that appears because a link was opened is a prompt with no visible
   * cause. The collect preflight is where that conversation happens, and the
   * reader gets there by pressing Collect.
   */
  test("never asks for location on the way back", async ({ page }) => {
    await stubSession(page, { kind: "signed-in" });
    await page.addInitScript(() => {
      const marker = window as unknown as { __locationAsked?: boolean };
      marker.__locationAsked = false;

      const geolocation = navigator.geolocation as unknown as
        | Record<string, (...args: unknown[]) => unknown>
        | undefined;

      if (!geolocation) {
        return;
      }

      for (const method of ["getCurrentPosition", "watchPosition"]) {
        const original = geolocation[method];

        if (!original) {
          continue;
        }

        geolocation[method] = (...args: unknown[]) => {
          marker.__locationAsked = true;

          return original.apply(navigator.geolocation, args);
        };
      }
    });

    await page.goto("/shops/ty-lee-pen-shop?auth=success");

    await expect(
      page.getByRole("status", { name: /sign-in result/i }),
    ).toContainText(/you are signed in/i);
    expect(
      await page.evaluate(
        () =>
          (window as unknown as { __locationAsked?: boolean }).__locationAsked ?? false,
      ),
    ).toBe(false);
  });
});
