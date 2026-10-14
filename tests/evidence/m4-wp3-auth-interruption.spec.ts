import { mkdir } from "node:fs/promises";
import path from "node:path";

import { expect, test, type Page } from "@playwright/test";

import { stubGoogle, stubMagicLink, stubSession } from "../support/auth";
import { seedSampleCollection, useNormalMode } from "../support/local-state";

/**
 * Milestone 4 WP3 review evidence: the authentication interruption, and Me in
 * every account state it now has.
 *
 * Not an assertion suite — `tests/e2e/auth-interruption.spec.ts` and
 * `tests/e2e/me.spec.ts` hold the verdicts. This writes screenshots into
 * `docs/evidence/milestone-4-wp3/` so the founder can read the states side by
 * side at the three breakpoints `IMPLEMENTATION-PLAN.md` names.
 *
 * Opted into with `EVIDENCE=1 pnpm test:e2e --project=evidence`.
 *
 * The session and the two start routes are the application's own, and this build
 * has no Supabase project behind them, so the states that need one are captured
 * against stubbed responses on those first-party routes. Everything above the
 * response is the real interface: the same components, copy and layout a hosted
 * build renders. WP6 owns the hosted proof.
 */
const OUT_DIR = path.join(process.cwd(), "docs", "evidence", "milestone-4-wp3");

const BREAKPOINTS = [
  { name: "m", width: 360, height: 800 },
  { name: "t", width: 768, height: 1024 },
  { name: "d", width: 1440, height: 900 },
] as const;

test.beforeAll(async () => {
  await mkdir(OUT_DIR, { recursive: true });
});

async function capture(page: Page, name: string) {
  await page.screenshot({
    path: path.join(OUT_DIR, `${name}.png`),
    animations: "disabled",
    fullPage: true,
  });
}

/**
 * A viewport capture, for the surfaces that are fixed to it.
 *
 * A full-page screenshot of a `position: fixed` overlay composites the overlay
 * at the top of a tall image of the page behind it, which is not what anyone
 * sees. The interruption and the result banner are both fixed, so they are
 * recorded as the reader's screen.
 */
async function captureViewport(page: Page, name: string) {
  await page.screenshot({
    path: path.join(OUT_DIR, `${name}.png`),
    animations: "disabled",
  });
}

async function openInterruption(page: Page) {
  await page.goto("/me");
  await page
    .getByRole("region", { name: /^account$/i })
    .getByRole("button", { name: /sign in/i })
    .click();

  const dialog = page.getByRole("dialog", { name: /sign in to nib atlas/i });

  await expect(dialog).toBeVisible();

  return dialog;
}

for (const breakpoint of BREAKPOINTS) {
  test.describe(`${breakpoint.width} × ${breakpoint.height}`, () => {
    test.use({ viewport: { width: breakpoint.width, height: breakpoint.height } });

    test.beforeEach(async ({ page }) => {
      await useNormalMode(page);
      // Reduced motion, so the captures are the settled surfaces rather than a
      // frame of an entry transition.
      await page.emulateMedia({ reducedMotion: "reduce" });
    });

    /** Me, signed out: the account is offered, and it is a working control. */
    test("me signed out", async ({ page }) => {
      await stubSession(page, { kind: "signed-out" });
      await seedSampleCollection(page);
      await page.goto("/me");

      await expect(
        page.getByRole("region", { name: /^account$/i }).getByRole("button", {
          name: /sign in/i,
        }),
      ).toBeVisible();
      await capture(page, `${breakpoint.name}-me-signed-out`);
    });

    /** The interruption itself, over the page it interrupted. */
    test("the interruption", async ({ page }) => {
      await stubSession(page, { kind: "signed-out" });
      await stubMagicLink(page);
      await openInterruption(page);

      await captureViewport(page, `${breakpoint.name}-interruption`);
    });

    /** What a reader is told once the link is on its way. */
    test("the link confirmation", async ({ page }) => {
      await stubSession(page, { kind: "signed-out" });
      await stubMagicLink(page);

      const dialog = await openInterruption(page);

      await dialog.getByLabel(/email address/i).fill("ada@example.com");
      await dialog.getByRole("button", { name: /email me a sign-in link/i }).click();

      await expect(page.getByRole("dialog", { name: /check your email/i })).toBeVisible();
      await captureViewport(page, `${breakpoint.name}-link-sent`);
    });

    /** A refusal, reported on the field that caused it. */
    test("a refused address", async ({ page }) => {
      await stubSession(page, { kind: "signed-out" });
      await stubMagicLink(page, {
        kind: "error",
        status: 400,
        code: "invalid_email",
      });

      const dialog = await openInterruption(page);

      await dialog.getByLabel(/email address/i).fill("ada@");
      await dialog.getByRole("button", { name: /email me a sign-in link/i }).click();

      await expect(page.getByRole("alert", { name: /sign-in/i })).toBeVisible();
      await captureViewport(page, `${breakpoint.name}-interruption-error`);
    });

    /**
     * The route form, carrying a pending Save. This is what an emailed link that
     * failed, a bookmark, or a shared address lands on.
     */
    test("the login route with a pending save", async ({ page }) => {
      await stubSession(page, { kind: "signed-out" });
      await stubMagicLink(page);
      await page.goto(
        "/login?returnTo=%2Fshops%2Fginza-itoya-main-store&intent=save-shop&shopId=9f1b6c3a-2d4e-4f8a-9c1b-5e7d2a3f4b60",
      );

      await expect(page.getByText(/you were saving a shop/i)).toBeVisible();
      await capture(page, `${breakpoint.name}-login-route`);
    });

    /** Coming back: the result, announced over the map the reader left. */
    test("the callback result on the map", async ({ page }) => {
      await stubSession(page, { kind: "signed-in", displayName: "Ada Lovelace" });
      await page.goto("/?shop=ginza-itoya-main-store&auth=success");

      await expect(page.getByRole("status", { name: /sign-in result/i })).toBeVisible();
      await captureViewport(page, `${breakpoint.name}-callback-success`);
    });

    /** And the failure form of it, which carries the way to try again. */
    test("an expired link on a shop page", async ({ page }) => {
      await stubSession(page, { kind: "signed-out" });
      await page.goto("/shops/ginza-itoya-main-store?authError=expired_link");

      await expect(page.getByRole("alert", { name: /sign-in/i })).toBeVisible();
      await captureViewport(page, `${breakpoint.name}-callback-expired`);
    });

    /** Me, signed in: the identity, and the rows that exist against it. */
    test("me signed in", async ({ page }) => {
      await stubSession(page, { kind: "signed-in", displayName: "Ada Lovelace" });
      await seedSampleCollection(page);
      await page.goto("/me");

      await expect(
        page.getByRole("region", { name: /^account$/i }).getByText("Ada Lovelace"),
      ).toBeVisible();
      await capture(page, `${breakpoint.name}-me-signed-in`);
    });

    /**
     * The two states a network answer adds: a build with no accounts behind it,
     * which is what the current staging deployment is, and a session read that
     * failed.
     */
    test("me with no accounts in the build", async ({ page }) => {
      await page.goto("/me");

      await expect(
        page.getByRole("region", { name: /^account$/i }),
      ).toContainText(/not available in this build/i);
      await capture(page, `${breakpoint.name}-me-unconfigured`);
    });

    test("me with a session that could not be read", async ({ page }) => {
      await stubSession(page, { kind: "unreachable" });
      await page.goto("/me");

      await expect(page.getByRole("alert", { name: /account status/i })).toBeVisible();
      await capture(page, `${breakpoint.name}-me-session-unreachable`);
    });

    /** Google, mid-handoff: the moment before the browser leaves. */
    test("leaving for the provider", async ({ page, baseURL }) => {
      await stubSession(page, { kind: "signed-out" });
      await stubGoogle(page, { kind: "error", status: 502, code: "google_unavailable" });

      const dialog = await openInterruption(page);

      await dialog.getByRole("button", { name: /continue with google/i }).click();
      await expect(page.getByRole("alert", { name: /sign-in/i })).toBeVisible();
      await captureViewport(page, `${breakpoint.name}-google-unavailable`);

      expect(baseURL).toBeTruthy();
    });
  });
}
