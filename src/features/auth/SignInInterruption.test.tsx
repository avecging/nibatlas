import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { leaveForProvider } from "@/src/features/auth/navigate";
import { readPendingFlow } from "@/src/features/auth/pending-flow";
import { useSignInPrompt } from "@/src/features/auth/SignInProvider";
import { installAuthFetch, WithAccount } from "@/src/test/auth";

const SHOP_ID = "9f1b6c3a-2d4e-4f8a-9c1b-5e7d2a3f4b60";

// jsdom performs no navigation and does not allow `location` to be replaced, so
// the one call that leaves the page is mocked at its seam.
vi.mock("@/src/features/auth/navigate", () => ({ leaveForProvider: vi.fn() }));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  window.sessionStorage.clear();
});

/**
 * The interruption, exercised the way a surface uses it.
 *
 * A caller asks for it, states what it interrupted and hands over the return
 * path; everything else — the two flows, the failure copy, focus, and the way
 * out — belongs to the interruption. The trigger below stands in for Me's
 * account row and, later, for the Save controls WP5 connects.
 */
function Trigger() {
  const { requestSignIn } = useSignInPrompt();

  return (
    <button
      onClick={() =>
        requestSignIn({
          context: "Save Ty Lee Pen Shop",
          intent: { type: "save-shop", shopId: SHOP_ID },
          returnTo: "/shops/ty-lee-pen-shop",
        })
      }
      type="button"
    >
      Save shop
    </button>
  );
}

async function openInterruption() {
  render(
    <WithAccount>
      <Trigger />
    </WithAccount>,
  );

  // Focused before it is clicked, because `fireEvent.click` does not move focus
  // the way a pointer or a keyboard does — and where focus was is exactly what
  // the dialog has to give back when it closes.
  const trigger = screen.getByRole("button", { name: "Save shop" });

  trigger.focus();
  fireEvent.click(trigger);

  return screen.getByRole("dialog", { name: /sign in to nib atlas/i });
}

describe("the sign-in interruption", () => {
  it("offers both ways in, and says what it interrupted", async () => {
    installAuthFetch();
    const dialog = await openInterruption();

    expect(within(dialog).getByText("Save Ty Lee Pen Shop")).toBeInTheDocument();
    expect(
      within(dialog).getByRole("button", { name: /continue with google/i }),
    ).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/email address/i)).toBeInTheDocument();
    expect(
      within(dialog).getByRole("button", { name: /email me a sign-in link/i }),
    ).toBeInTheDocument();

    /*
     * The property that makes this an interruption rather than a wall: a named
     * way out, and a line saying what still works without an account.
     */
    expect(within(dialog).getByRole("button", { name: /not now/i })).toBeInTheDocument();
    expect(dialog).toHaveTextContent(/work without an account/i);
    expect(dialog).not.toHaveTextContent(/you need an account/i);
  });

  /*
   * The privacy line says what is true of the address and no more. "Stores your
   * address to sign you in and nothing else" was broader than the contract —
   * authentication involves an account identifier and a session, and the chosen
   * path involves a provider — and the full account is on Privacy, linked from
   * here rather than summarised into a promise.
   */
  it("claims no more about the address than is true", async () => {
    installAuthFetch();
    const dialog = await openInterruption();

    expect(dialog).toHaveTextContent(/is not shown publicly/i);
    expect(dialog.textContent).not.toMatch(/nothing else/i);
    expect(
      within(dialog).getByRole("link", { name: /what we store/i }),
    ).toHaveAttribute("href", "/privacy");
  });

  it("carries the return path and the pending intent to the server", async () => {
    const { requests } = installAuthFetch();
    const dialog = await openInterruption();

    fireEvent.change(within(dialog).getByLabelText(/email address/i), {
      target: { value: "ada@example.com" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: /email me a sign-in link/i }));

    await waitFor(() => {
      expect(screen.getByRole("dialog", { name: /check your email/i })).toBeInTheDocument();
    });

    expect(requests.at(-1)).toMatchObject({
      url: "/api/v1/auth/magic-link",
      body: {
        email: "ada@example.com",
        returnTo: "/shops/ty-lee-pen-shop",
        intent: { type: "save-shop", shopId: SHOP_ID },
      },
    });
  });

  it("confirms where the link went without promising an unconfigured sender", async () => {
    installAuthFetch();
    const dialog = await openInterruption();

    fireEvent.change(within(dialog).getByLabelText(/email address/i), {
      target: { value: "ada@example.com" },
    });
    fireEvent.click(
      within(dialog).getByRole("button", { name: /email me a sign-in link/i }),
    );

    const confirmation = await screen.findByRole("status");

    expect(confirmation).toHaveTextContent("ada@example.com");
    /*
     * The sender is described, not named. Naming it before WP6 has proven
     * hosted delivery would be a claim about where the message came from that
     * nobody has tested — and on a project whose custom SMTP is not switched on
     * the route can succeed while the mail arrives from elsewhere.
     */
    expect(screen.getByRole("dialog")).toHaveTextContent(/Nib Atlas sign-in message/i);
    // Any address, not just today's: the guard has to fail if a later change
    // names one before that proof exists.
    expect(screen.getByRole("dialog").textContent).not.toMatch(/@nibatlas\.com/i);
    // The address is repeated back so a typo is visible, and correcting it does
    // not mean dismissing and reopening the interruption.
    expect(
      screen.getByRole("button", { name: /use a different address/i }),
    ).toBeInTheDocument();
  });

  /*
   * The route answers the same way whether or not the address had an account,
   * and the confirmation keeps it that way: no wording here distinguishes a new
   * account from a returning one, because doing so would turn the form into a
   * way of asking whether someone has an account.
   */
  it("does not reveal whether the address already had an account", async () => {
    installAuthFetch();
    const dialog = await openInterruption();

    fireEvent.change(within(dialog).getByLabelText(/email address/i), {
      target: { value: "ada@example.com" },
    });
    fireEvent.click(
      within(dialog).getByRole("button", { name: /email me a sign-in link/i }),
    );

    const confirmation = await screen.findByRole("dialog", { name: /check your email/i });

    expect(confirmation).not.toHaveTextContent(/welcome back|new account|we found/i);
  });

  it("reports a refused address on the field that caused it", async () => {
    installAuthFetch({ magicLink: { status: 400, code: "invalid_email" } });
    const dialog = await openInterruption();

    fireEvent.change(within(dialog).getByLabelText(/email address/i), {
      target: { value: "ada@" },
    });
    fireEvent.click(
      within(dialog).getByRole("button", { name: /email me a sign-in link/i }),
    );

    const alert = await screen.findByRole("alert");

    expect(alert).toHaveTextContent(/does not look like an email address/i);
    expect(within(dialog).getByLabelText(/email address/i)).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    // Still usable: the form is where the correction happens.
    expect(
      within(dialog).getByRole("button", { name: /email me a sign-in link/i }),
    ).toBeEnabled();
  });

  it("says what to do when too many links have been asked for", async () => {
    installAuthFetch({ magicLink: { status: 429, code: "magic_link_unavailable" } });
    const dialog = await openInterruption();

    fireEvent.change(within(dialog).getByLabelText(/email address/i), {
      target: { value: "ada@example.com" },
    });
    fireEvent.click(
      within(dialog).getByRole("button", { name: /email me a sign-in link/i }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(/wait a few minutes/i);
  });

  it("asks for an address before posting an empty one", async () => {
    const { requests } = installAuthFetch();
    const dialog = await openInterruption();

    fireEvent.click(
      within(dialog).getByRole("button", { name: /email me a sign-in link/i }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(/enter the email address/i);
    expect(requests.some((request) => request.url.includes("magic-link"))).toBe(false);
  });

  it("hands the provider URL to the browser as a top-level navigation", async () => {
    installAuthFetch({
      google: {
        status: 200,
        redirectTo: "https://project.supabase.co/auth/v1/authorize?provider=google",
      },
    });
    const dialog = await openInterruption();

    fireEvent.click(within(dialog).getByRole("button", { name: /continue with google/i }));

    await waitFor(() => {
      expect(leaveForProvider).toHaveBeenCalledWith(
        "https://project.supabase.co/auth/v1/authorize?provider=google",
      );
    });
  });

  it("returns to the panel when Google cannot be started", async () => {
    installAuthFetch({ google: { status: 502, code: "google_unavailable" } });
    const dialog = await openInterruption();

    fireEvent.click(within(dialog).getByRole("button", { name: /continue with google/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/not responding just now/i);
    expect(
      within(dialog).getByRole("button", { name: /continue with google/i }),
    ).toBeEnabled();
  });

  it("closes on Escape and on the way out, returning focus to the control", async () => {
    installAuthFetch();
    await openInterruption();

    fireEvent.keyDown(document, { key: "Escape" });

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: "Save shop" })).toHaveFocus();

    const trigger = screen.getByRole("button", { name: "Save shop" });

    trigger.focus();
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole("button", { name: /not now/i }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: "Save shop" })).toHaveFocus();
  });

  it("is a modal dialog labelled by its own heading", async () => {
    installAuthFetch();
    const dialog = await openInterruption();

    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAttribute("aria-labelledby", "sign-in-interruption-title");
  });
});

describe("the callback's result", () => {
  it("announces a completed sign-in wherever the reader landed", async () => {
    installAuthFetch({ session: { kind: "signed-in" } });
    window.history.replaceState(null, "", "/shops/ty-lee-pen-shop?auth=success");

    render(
      <WithAccount>
        <Trigger />
      </WithAccount>,
    );

    const banner = await screen.findByRole("status");

    expect(banner).toHaveTextContent(/you are signed in/i);

    fireEvent.click(screen.getByRole("button", { name: /dismiss this message/i }));

    await waitFor(() => {
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
    });

    window.history.replaceState(null, "", "/");
  });

  /*
   * The retry carries the flow that failed.
   *
   * A failed callback clears the server's continuation on its way here, so a
   * retry that started a blank flow would post `intent: null` — and the Save
   * this interruption was opened for could then never complete, whatever the
   * reader did next. The flow is remembered in the tab that started it,
   * survives the callback's navigation, and is re-sent for the server to
   * validate again.
   */
  it("carries the failed flow's intent into the retry", async () => {
    const { requests } = installAuthFetch({ session: { kind: "signed-out" } });
    const dialog = await openInterruption();

    fireEvent.change(within(dialog).getByLabelText(/email address/i), {
      target: { value: "ada@example.com" },
    });
    fireEvent.click(
      within(dialog).getByRole("button", { name: /email me a sign-in link/i }),
    );
    await screen.findByRole("dialog", { name: /check your email/i });

    // The callback comes back through a full navigation, with the flow cookie
    // already cleared, so the retry has only the tab's own record to work from.
    cleanup();
    window.history.replaceState(null, "", "/shops/ty-lee-pen-shop?authError=expired_link");
    render(
      <WithAccount>
        <Trigger />
      </WithAccount>,
    );

    const alert = await screen.findByRole("alert", { name: /sign-in result/i });

    fireEvent.click(within(alert).getByRole("button", { name: /try again/i }));

    const retried = await screen.findByRole("dialog", {
      name: /sign in to nib atlas/i,
    });

    // Named again, from the intent alone, so the reader is not asked to
    // remember what they were doing either.
    expect(retried).toHaveTextContent(/you were saving a shop/i);

    fireEvent.change(within(retried).getByLabelText(/email address/i), {
      target: { value: "ada@example.com" },
    });
    fireEvent.click(
      within(retried).getByRole("button", { name: /email me a sign-in link/i }),
    );

    await waitFor(() => {
      expect(requests.at(-1)?.url).toContain("magic-link");
    });
    expect(requests.at(-1)?.body).toMatchObject({
      returnTo: "/shops/ty-lee-pen-shop",
      intent: { type: "save-shop", shopId: SHOP_ID },
    });

    window.history.replaceState(null, "", "/");
  });

  /*
   * And it is forgotten once a sign-in completes: from then on the pending
   * intent is the server's cookie, which is the copy that completes the action.
   */
  it("forgets the flow once a sign-in has completed", async () => {
    installAuthFetch({ session: { kind: "signed-out" } });
    const dialog = await openInterruption();

    fireEvent.change(within(dialog).getByLabelText(/email address/i), {
      target: { value: "ada@example.com" },
    });
    fireEvent.click(
      within(dialog).getByRole("button", { name: /email me a sign-in link/i }),
    );
    await screen.findByRole("dialog", { name: /check your email/i });

    expect(readPendingFlow()).not.toBeNull();

    cleanup();
    installAuthFetch({ session: { kind: "signed-in" } });
    window.history.replaceState(null, "", "/shops/ty-lee-pen-shop?auth=success");
    render(
      <WithAccount>
        <Trigger />
      </WithAccount>,
    );

    await screen.findByRole("status", { name: /sign-in result/i });
    expect(readPendingFlow()).toBeNull();

    window.history.replaceState(null, "", "/");
  });

  /*
   * An expired link returns the reader to where they started with nothing to
   * show that anything happened, so the failure carries the way to try again.
   */
  it("offers another attempt when a link had expired", async () => {
    installAuthFetch({ session: { kind: "signed-out" } });
    window.history.replaceState(null, "", "/me?authError=expired_link");

    render(
      <WithAccount>
        <Trigger />
      </WithAccount>,
    );

    const alert = await screen.findByRole("alert");

    expect(alert).toHaveTextContent(/that sign-in link has expired/i);

    fireEvent.click(within(alert).getByRole("button", { name: /try again/i }));

    expect(
      await screen.findByRole("dialog", { name: /sign in to nib atlas/i }),
    ).toBeInTheDocument();

    window.history.replaceState(null, "", "/");
  });
});
