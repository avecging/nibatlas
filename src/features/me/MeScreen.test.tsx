import { fireEvent, render, screen, within } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
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
    expect(device).toHaveTextContent(/clearing this browser's data clears them/i);
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

  it("routes Suggest a pen shop, and defers only the correction", () => {
    renderMe();

    const contribute = region(/contribute/i);

    expect(
      within(contribute).getByRole("link", { name: /suggest a pen shop/i }),
    ).toHaveAttribute(
      "href",
      "mailto:hello@nibatlas.com?subject=%5BSuggest%20shop%5D",
    );

    // A routed entry carries no pending badge; the deferred one carries exactly
    // one, and normal mode states it without a work-package number.
    expect(within(contribute).getAllByText("Not open yet")).toHaveLength(1);
    expect(
      within(contribute).getByText("Report incorrect information"),
    ).toBeInTheDocument();
    expect(within(contribute).queryByText(/WP7|Milestone/i)).not.toBeInTheDocument();
  });

  /*
   * Reduced motion and Accessibility are facts about how the product behaves,
   * not controls. Milestone 1 rendered them as rows with a badge explaining why
   * they could not be pressed, which is the checklist presentation WP2 removes.
   */
  it("states preferences as copy rather than as inert rows", () => {
    renderMe();

    const preferences = region(/preferences and accessibility/i);

    // The copy uses a typographic apostrophe, so the pattern goes around it.
    expect(preferences).toHaveTextContent(/reduced-motion setting/i);
    expect(preferences).toHaveTextContent(/keyboard navigation with visible focus/i);
    expect(within(preferences).queryAllByRole("button")).toHaveLength(0);
    expect(within(preferences).queryAllByRole("listitem")).toHaveLength(0);
    expect(within(preferences).queryByText(/no in-app override/i)).not.toBeInTheDocument();
    expect(within(preferences).queryByText(/reference only/i)).not.toBeInTheDocument();
  });

  /*
   * The copy corrections from the Codex review. Clearing removes two things; it
   * does not leave the device free of Nib Atlas, it does not touch preferences,
   * and removing the app from a home screen is not stated as deleting data —
   * that varies by platform and on several it does not.
   */
  it("does not overstate what the local-data controls cover", () => {
    renderMe({ collection: "seeded" });

    const device = region(/on this device/i);

    expect(device).toHaveTextContent(/saved shops and collected impressions/i);
    expect(device).not.toHaveTextContent(/preferences are stored/i);
    expect(device).not.toHaveTextContent(/home screen/i);

    fireEvent.click(screen.getByRole("button", { name: /clear data on this device/i }));
    expect(screen.getByText(/clear your saved shops and collected impressions/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^clear this device$/i }));

    const status = screen.getByRole("status", {
      name: /clear data on this device result/i,
    });

    expect(status).toHaveTextContent(/removed from this browser/i);
    expect(status).not.toHaveTextContent(/nothing from nib atlas/i);
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
    expect(
      screen.getByRole("status", { name: /clear data on this device result/i }),
    ).toHaveTextContent(/cleared/i);
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
    expect(
      screen.getByRole("status", { name: /download local data result/i }),
    ).toHaveTextContent(/downloaded/i);

    created.mockRestore();
    revoked.mockRestore();
    clicked.mockRestore();
  });

  /*
   * A browser that blocks object URLs must produce a message rather than a
   * control that looks like it worked and silently did nothing.
   */
  /*
   * A live region nested inside a button is flattened into that button's
   * accessible name and never announced. The result has to be a sibling.
   */
  it("keeps each result outside the button that produced it", () => {
    renderMe({ collection: "seeded" });

    const result = screen.getByRole("status", {
      name: /download local data result/i,
    });

    expect(result.closest("button")).toBeNull();
    expect(
      screen.getByRole("button", { name: /download local data/i }),
    ).not.toContainElement(result);
  });

  it("says so when the browser refuses the download", () => {
    const created = vi.spyOn(URL, "createObjectURL").mockImplementation(() => {
      throw new Error("blocked");
    });

    renderMe({ collection: "seeded" });

    fireEvent.click(screen.getByRole("button", { name: /download local data/i }));

    expect(
      screen.getByRole("status", { name: /download local data result/i }),
    ).toHaveTextContent(/blocked the download/i);

    created.mockRestore();
  });
});

describe("Me, the hydration guard", () => {
  /*
   * The first paint is the empty baseline, whatever the device actually holds:
   * the collection store reads `localStorage` in an effect, which has not run
   * yet. A returning reader who managed to press Download in that window would
   * receive an empty file that looks exactly like a successful export of
   * nothing — so the controls are not operable until the store has been read.
   *
   * Rendered to static markup rather than through Testing Library, because that
   * *is* the first paint: effects do not run, so this is the pre-hydration DOM a
   * real browser paints.
   */
  it("holds Download and Clear until the device's state has been read", () => {
    window.localStorage.setItem(
      COLLECTION_STORAGE_KEYS.normal,
      JSON.stringify({
        savedShopIds: prototypeSeedSavedShopIds,
        collections: prototypeSeedCollections,
      }),
    );

    const markup = renderToStaticMarkup(
      <WithReviewerMode>
        <AccountSessionProvider>
          <CollectionProvider>
            <MeScreen />
          </CollectionProvider>
        </AccountSessionProvider>
      </WithReviewerMode>,
    );

    const container = document.createElement("div");
    container.innerHTML = markup;

    const buttons = [...container.querySelectorAll("button")];
    const named = (label: RegExp) =>
      buttons.find((button) => label.test(button.textContent ?? ""));

    expect(named(/Download local data/)).toHaveAttribute("disabled");
    expect(named(/Clear data on this device/)).toHaveAttribute("disabled");
  });

  it("releases them once it has", () => {
    renderMe({ collection: "seeded" });

    expect(
      screen.getByRole("button", { name: /download local data/i }),
    ).toBeEnabled();
    expect(
      screen.getByRole("button", { name: /clear data on this device/i }),
    ).toBeEnabled();
  });
});

describe("Me, destructive confirmations", () => {
  /*
   * Opening the panel and confirming it are one keystroke apart if focus lands
   * on the destructive button: pressing Enter twice — an ordinary way to work
   * down a list of buttons — would delete a collection the reader never saw the
   * question about.
   */
  it("opens with focus on Cancel, not on the destructive action", () => {
    renderMe({ collection: "seeded" });

    const trigger = screen.getByRole("button", { name: /clear data on this device/i });

    fireEvent.click(trigger);

    expect(screen.getByRole("button", { name: /^cancel$/i })).toHaveFocus();
    expect(screen.getByRole("button", { name: /^clear this device$/i })).not.toHaveFocus();
  });

  it("returns focus to the row when cancelled", () => {
    renderMe({ collection: "seeded" });

    const trigger = screen.getByRole("button", { name: /clear data on this device/i });

    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole("button", { name: /^cancel$/i }));

    expect(trigger).toHaveFocus();
  });

  it("returns focus to the row when the action goes through", () => {
    renderMe({ collection: "seeded" });

    const trigger = screen.getByRole("button", { name: /clear data on this device/i });

    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole("button", { name: /^clear this device$/i }));

    expect(trigger).toHaveFocus();
  });

  /*
   * The double-Enter case, which is the reason Cancel takes focus.
   *
   * A keyboard activation of a button is a click, so the two `click` calls here
   * are the two Enter presses: the first opens the panel, and the second lands
   * on whatever now holds focus. The collection has to survive it.
   */
  it("survives two Enter presses in a row", () => {
    renderMe({ collection: "seeded" });

    const trigger = screen.getByRole("button", { name: /clear data on this device/i });

    trigger.focus();
    fireEvent.click(document.activeElement!);
    fireEvent.click(document.activeElement!);

    expect(trigger).toHaveFocus();
    expect(screen.getByRole("region", { name: /places visited/i })).toBeInTheDocument();
    expect(screen.queryByText(/cleared\./i)).not.toBeInTheDocument();
  });

  it("applies the same rule to Delete account", () => {
    renderMe({ reviewer: true, signedIn: true });

    fireEvent.click(screen.getByRole("button", { name: /delete account/i }));

    expect(screen.getByRole("button", { name: /^cancel$/i })).toHaveFocus();
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
