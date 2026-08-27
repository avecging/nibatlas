import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ACCOUNT_PREVIEW_STORAGE_KEY } from "@/src/features/account/account-session";
import { AccountSessionProvider } from "@/src/features/account/AccountSessionProvider";
import {
  COLLECTION_STORAGE_KEYS,
  CollectionProvider,
} from "@/src/features/collection/collection-store";
import { MeScreen } from "@/src/features/me/MeScreen";
import {
  prototypeSeedCollections,
  prototypeSeedSavedShopIds,
} from "@/src/fixtures/prototype-passport";
import { seedReviewerMode, WithReviewerMode } from "@/src/test/reviewer";

/**
 * Me's two states, checked as structure rather than as copy.
 *
 * The properties that matter are which groups exist, what a control does when
 * it is used, and — most of all — that a normal-mode device can never be put
 * into the signed-in state, because there is nothing to sign in to yet.
 */
function renderMe({
  reviewer = false,
  signedIn = false,
  collection,
}: {
  readonly reviewer?: boolean;
  readonly signedIn?: boolean;
  readonly collection?: "seeded";
} = {}) {
  seedReviewerMode(reviewer);

  if (signedIn) {
    window.localStorage.setItem(
      ACCOUNT_PREVIEW_STORAGE_KEY,
      JSON.stringify({ signedIn: true, displayName: null }),
    );
  }

  if (collection === "seeded") {
    window.localStorage.setItem(
      COLLECTION_STORAGE_KEYS[reviewer ? "reviewer" : "normal"],
      JSON.stringify({
        savedShopIds: prototypeSeedSavedShopIds,
        collections: prototypeSeedCollections,
      }),
    );
  }

  render(
    <WithReviewerMode>
      <AccountSessionProvider>
        <CollectionProvider>
          <MeScreen />
        </CollectionProvider>
      </AccountSessionProvider>
    </WithReviewerMode>,
  );
}

function region(name: RegExp) {
  return screen.getByRole("region", { name });
}

describe("Me, signed out", () => {
  it("offers an account rather than claiming one is needed", () => {
    renderMe();

    const account = region(/^account$/i);

    expect(within(account).getByText("Sign in")).toBeInTheDocument();
    expect(within(account).getByText("Not available yet")).toBeInTheDocument();
    expect(within(account).queryByText(/needs an account/i)).not.toBeInTheDocument();
  });

  it("gathers the local-data facts and controls into one group", () => {
    renderMe();

    const device = region(/on this device/i);

    expect(device).toHaveTextContent(/do not sync/i);
    expect(device).toHaveTextContent(/lost if you clear this browser's data/i);
    expect(
      within(device).getByRole("button", { name: /download local data/i }),
    ).toBeInTheDocument();
    expect(
      within(device).getByRole("button", { name: /clear data on this device/i }),
    ).toBeInTheDocument();
  });

  it("has no Danger group, because there is no account to delete", () => {
    renderMe();

    expect(screen.queryByRole("region", { name: /danger/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/delete account/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /sign out/i })).not.toBeInTheDocument();
  });

  it("places the Contribute entries WP7 will route", () => {
    renderMe();

    const contribute = region(/contribute/i);

    expect(within(contribute).getByText("Suggest a pen shop")).toBeInTheDocument();
    expect(
      within(contribute).getByText("Report incorrect information"),
    ).toBeInTheDocument();
    // The entries exist; the routing does not, and normal mode says so without a
    // work-package number.
    expect(within(contribute).getAllByText("Not open yet")).toHaveLength(2);
    expect(
      within(contribute).queryByText(/WP7|Milestone/i),
    ).not.toBeInTheDocument();
  });

  it("omits Places visited until there is something to point at", () => {
    renderMe();

    expect(
      screen.queryByRole("region", { name: /places visited/i }),
    ).not.toBeInTheDocument();
  });
});

describe("Me, places visited", () => {
  it("links each country and locality into the Passport", () => {
    renderMe({ collection: "seeded" });

    const places = region(/places visited/i);

    expect(within(places).getByRole("link", { name: /japan/i })).toHaveAttribute(
      "href",
      "/passport/jp",
    );
    expect(within(places).getByRole("link", { name: /chūō, tokyo/i })).toHaveAttribute(
      "href",
      "/passport/jp/chuo-tokyo",
    );
    expect(within(places).getByRole("link", { name: /open passport/i })).toHaveAttribute(
      "href",
      "/passport",
    );
  });

  /*
   * The Milestone 1 defect: a country is visited on its first stamp, but its
   * seal is a separate threshold. Reporting seals as visits hid two of the three
   * countries the reader had actually been to.
   */
  it("counts visits from stamps, and states seal progress separately", () => {
    renderMe({ collection: "seeded" });

    const places = region(/places visited/i);

    expect(within(places).getByText("Countries").previousSibling).toHaveTextContent("3");
    expect(within(places).getByText("Localities").previousSibling).toHaveTextContent("5");
    // Japan and Taiwan both stand at two of four; Singapore's seal is earned, so
    // it states no progress at all.
    expect(
      within(places).getAllByText(
        /2 of 4 curated shops collected towards the country seal/i,
      ),
    ).toHaveLength(2);
    expect(within(places).getByText("Seal")).toBeInTheDocument();
  });

  it("keeps the coverage-set version out of the product surface", () => {
    renderMe({ collection: "seeded" });

    expect(screen.queryByText(/curated set [a-z]{2}-/i)).not.toBeInTheDocument();
  });
});

describe("Me, local-data controls", () => {
  it("asks before clearing, and clears only when confirmed", () => {
    renderMe({ collection: "seeded" });

    expect(screen.getByRole("region", { name: /places visited/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /clear data on this device/i }));
    fireEvent.click(screen.getByRole("button", { name: /^cancel$/i }));

    // Cancelling changes nothing.
    expect(screen.getByRole("region", { name: /places visited/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /clear data on this device/i }));
    fireEvent.click(screen.getByRole("button", { name: /^clear this device$/i }));

    expect(
      screen.queryByRole("region", { name: /places visited/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(/cleared/i);
  });

  it("hands over a file, named for the day it was taken", () => {
    const created = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:nib-atlas");
    const revoked = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    // Stubbed rather than called through: jsdom has no download behaviour and
    // logs a navigation warning if the anchor is actually followed.
    const clicked = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});

    renderMe({ collection: "seeded" });

    fireEvent.click(screen.getByRole("button", { name: /download local data/i }));

    expect(created).toHaveBeenCalledOnce();
    expect(clicked).toHaveBeenCalledOnce();
    expect(screen.getByRole("status")).toHaveTextContent(/downloaded/i);

    created.mockRestore();
    revoked.mockRestore();
    clicked.mockRestore();
  });

  /*
   * A browser that blocks object URLs must produce a message rather than a
   * control that looks like it worked and silently did nothing.
   */
  it("says so when the browser refuses the download", () => {
    const created = vi.spyOn(URL, "createObjectURL").mockImplementation(() => {
      throw new Error("blocked");
    });

    renderMe({ collection: "seeded" });

    fireEvent.click(screen.getByRole("button", { name: /download local data/i }));

    expect(screen.getByRole("status")).toHaveTextContent(/blocked the download/i);

    created.mockRestore();
  });
});

describe("Me, the signed-in structure", () => {
  /*
   * The property the account seam exists for: a stored preview must not be able
   * to sign a tester in, whatever put it there.
   */
  it("stays signed out in normal mode even with a stored preview", () => {
    renderMe({ signedIn: true });

    expect(screen.getByText("Sign in")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: /danger/i })).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText(/display name/i),
    ).not.toBeInTheDocument();
  });

  it("renders identity, display name, sign out and Danger in reviewer mode", () => {
    renderMe({ reviewer: true, signedIn: true });

    const account = region(/^account$/i);

    // The account address stands in for the headline until a display name is
    // chosen, so it appears both as the name and as the identity beneath it.
    expect(within(account).getAllByText(/reviewer@nibatlas.example/)).toHaveLength(2);
    expect(within(account).getByText(/reviewer preview/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/display name/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sign out/i })).toBeInTheDocument();

    const danger = region(/danger/i);

    expect(within(danger).getByText("Delete account")).toBeInTheDocument();
  });

  it("keeps the stored name when Save is pressed without typing", () => {
    window.localStorage.setItem(
      ACCOUNT_PREVIEW_STORAGE_KEY,
      JSON.stringify({ signedIn: true, displayName: "Ada" }),
    );
    seedReviewerMode(true);

    render(
      <WithReviewerMode>
        <AccountSessionProvider>
          <CollectionProvider>
            <MeScreen />
          </CollectionProvider>
        </AccountSessionProvider>
      </WithReviewerMode>,
    );

    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));

    expect(screen.getByLabelText(/display name/i)).toHaveValue("Ada");
    expect(screen.getByRole("region", { name: /^account$/i })).toHaveTextContent("Ada");
  });

  it("asks before deleting the account", () => {
    renderMe({ reviewer: true, signedIn: true });

    fireEvent.click(screen.getByRole("button", { name: /delete account/i }));

    expect(screen.getByText(/delete your nib atlas account\?/i)).toBeInTheDocument();
    expect(screen.getByText(/cannot be undone/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^cancel$/i }));

    expect(screen.getByRole("region", { name: /danger/i })).toBeInTheDocument();
  });

  it("offers the preview only to reviewers, and only while signed out", () => {
    renderMe({ reviewer: true });

    const control = screen.getByRole("button", {
      name: /preview the signed-in account/i,
    });

    fireEvent.click(control);

    expect(screen.getByRole("region", { name: /danger/i })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /preview the signed-in account/i }),
    ).not.toBeInTheDocument();
  });

  it("is not offered at all in normal mode", () => {
    renderMe();

    expect(
      screen.queryByRole("button", { name: /preview the signed-in account/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("region", { name: /prototype controls/i }),
    ).not.toBeInTheDocument();
  });
});
