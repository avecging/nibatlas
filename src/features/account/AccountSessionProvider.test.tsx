import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { accountHeadline } from "@/src/features/account/account-session";
import {
  AccountSessionProvider,
  useAccountSession,
} from "@/src/features/account/AccountSessionProvider";
import { installAuthFetch, SESSION_IDENTITY } from "@/src/test/auth";

afterEach(() => {
  vi.unstubAllGlobals();
  window.history.replaceState(null, "", "/me");
});

/** A probe, so the provider is tested through the contract its consumers use. */
function Probe() {
  const { session, authResult, signOut } = useAccountSession();

  return (
    <div>
      <p data-testid="status">{session.status}</p>
      <p data-testid="headline">{accountHeadline(session)}</p>
      <p data-testid="result">{authResult ? authResult.kind : "none"}</p>
      <button
        onClick={() => {
          void signOut();
        }}
        type="button"
      >
        Sign out
      </button>
    </div>
  );
}

function renderProbe() {
  return render(
    <AccountSessionProvider>
      <Probe />
    </AccountSessionProvider>,
  );
}

describe("AccountSessionProvider", () => {
  /*
   * The first paint is loading on the server and on the client alike. Rendering
   * signed out while the answer is in flight would flash the anonymous account
   * section at a signed-in reader on every navigation.
   */
  it("starts in the loading state and stays there until the route answers", async () => {
    installAuthFetch({ session: { kind: "pending" } });
    renderProbe();

    expect(screen.getByTestId("status")).toHaveTextContent("loading");
    await waitFor(() => {
      expect(screen.getByTestId("status")).toHaveTextContent("loading");
    });
  });

  it("resolves a signed-in session and addresses the reader", async () => {
    installAuthFetch({ session: { kind: "signed-in" } });
    renderProbe();

    await waitFor(() => {
      expect(screen.getByTestId("status")).toHaveTextContent("signed-in");
    });
    expect(screen.getByTestId("headline")).toHaveTextContent(SESSION_IDENTITY);
  });

  it("distinguishes a build with no authentication from a failed read", async () => {
    installAuthFetch({ session: { kind: "not-configured" } });
    const { unmount } = renderProbe();

    await waitFor(() => {
      expect(screen.getByTestId("status")).toHaveTextContent("unavailable");
    });
    unmount();

    installAuthFetch({ session: { kind: "unreachable" } });
    renderProbe();

    await waitFor(() => {
      expect(screen.getByTestId("status")).toHaveTextContent("unavailable");
    });
  });

  /*
   * The callback cannot render: it redirects to the reader's own return path
   * with its result in the query. The result is read once, announced, and taken
   * out of the address bar — left in place it would re-announce on every reload
   * and be carried into the next return path started from that page.
   */
  it("takes the callback's success out of the address bar", async () => {
    installAuthFetch({ session: { kind: "signed-in" } });
    window.history.replaceState(null, "", "/?shop=ty-lee-pen-shop&auth=success");
    renderProbe();

    await waitFor(() => {
      expect(screen.getByTestId("result")).toHaveTextContent("signed-in");
    });
    expect(window.location.search).toBe("?shop=ty-lee-pen-shop");
  });

  it("keeps a callback failure as a failure, and leaves the rest of the URL alone", async () => {
    installAuthFetch({ session: { kind: "signed-out" } });
    window.history.replaceState(null, "", "/me?authError=expired_link#me-account");
    renderProbe();

    await waitFor(() => {
      expect(screen.getByTestId("result")).toHaveTextContent("failed");
    });
    expect(screen.getByTestId("status")).toHaveTextContent("signed-out");
    expect(window.location.search).toBe("");
    expect(window.location.hash).toBe("#me-account");
  });

  it("ignores an authError value it has no copy for", async () => {
    installAuthFetch({ session: { kind: "signed-out" } });
    window.history.replaceState(null, "", "/me?authError=<script>");
    renderProbe();

    await waitFor(() => {
      expect(screen.getByTestId("status")).toHaveTextContent("signed-out");
    });
    expect(screen.getByTestId("result")).toHaveTextContent("none");
  });

  describe("signing out", () => {
    it("adopts the signed-out state as soon as the server confirms it", async () => {
      installAuthFetch({ session: { kind: "signed-in" } });
      renderProbe();

      await waitFor(() => {
        expect(screen.getByTestId("status")).toHaveTextContent("signed-in");
      });

      screen.getByRole("button", { name: "Sign out" }).click();

      await waitFor(() => {
        expect(screen.getByTestId("status")).toHaveTextContent("signed-out");
      });
    });

    /* A failed sign-out leaves the session alone: the reader is still signed in,
       and the surface that asked reports it. */
    it("keeps the session when the server refuses", async () => {
      installAuthFetch({ session: { kind: "signed-in" }, signOut: { status: 502 } });
      renderProbe();

      await waitFor(() => {
        expect(screen.getByTestId("status")).toHaveTextContent("signed-in");
      });

      screen.getByRole("button", { name: "Sign out" }).click();

      await waitFor(() => {
        expect(screen.getByTestId("status")).toHaveTextContent("signed-in");
      });
    });
  });
});
