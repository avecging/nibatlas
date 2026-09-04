import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import {
  COLLECTION_STORAGE_KEYS,
  CollectionProvider,
} from "@/src/features/collection/collection-store";
import { MeScreen } from "@/src/features/me/MeScreen";
import {
  prototypeSeedCollections,
  prototypeSeedSavedShopIds,
} from "@/src/fixtures/prototype-passport";
import {
  installAuthFetch,
  SESSION_IDENTITY,
  WithAccount,
  type SessionFixture,
} from "@/src/test/auth";
import { seedReviewerMode } from "@/src/test/reviewer";

/**
 * Me's two states, checked as structure rather than as copy.
 *
 * The properties that matter are which groups exist, what a control does when
 * it is used, and — most of all — that a normal-mode device can never be put
 * into the signed-in state, because there is nothing to sign in to yet.
 */
async function renderMe({
  reviewer = false,
  session = { kind: "signed-out" },
  collection,
}: {
  readonly reviewer?: boolean;
  /** Arranged as the answer the session route gives, not as provider state. */
  readonly session?: SessionFixture;
  readonly collection?: "seeded";
} = {}) {
  seedReviewerMode(reviewer);
  const fetched = installAuthFetch({ session });

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
    <WithAccount>
      <CollectionProvider>
        <MeScreen />
      </CollectionProvider>
    </WithAccount>,
  );

  // Every state below is a settled one, so each test waits for the session read
  // to finish rather than asserting against the loading state by accident.
  if (session.kind !== "pending") {
    await waitFor(() => {
      expect(
        screen.queryByText(/Checking your account/i),
      ).not.toBeInTheDocument();
    });
  }

  // Returned so a test can assert what the screen asked the server for.
  return fetched;
}

function region(name: RegExp) {
  return screen.getByRole("region", { name });
}

describe("Me, signed out", () => {
  it("offers an account as a working control rather than claiming one is needed", async () => {
    await renderMe();

    const account = region(/^account$/i);
    const signIn = within(account).getByRole("button", { name: /sign in/i });

    // The row carried "Not available yet" for three work packages. It is a
    // button now, and the explanation beside it is unchanged.
    expect(signIn).toBeEnabled();
    expect(within(account).queryByText("Not available yet")).not.toBeInTheDocument();
    expect(within(account).queryByText(/needs an account/i)).not.toBeInTheDocument();

    fireEvent.click(signIn);

    expect(
      screen.getByRole("dialog", { name: /sign in to nib atlas/i }),
    ).toBeInTheDocument();
  });

  /*
   * The interruption returns to this section, not to wherever a `returnTo`
   * happened to be captured from: a reader who signed in from Me is looking for
   * their account when they come back.
   */
  it("returns to the account section after signing in", async () => {
    const { requests } = await renderMe();

    fireEvent.click(within(region(/^account$/i)).getByRole("button", { name: /sign in/i }));

    const dialog = screen.getByRole("dialog", { name: /sign in to nib atlas/i });

    fireEvent.change(within(dialog).getByLabelText(/email address/i), {
      target: { value: "ada@example.com" },
    });
    fireEvent.click(
      within(dialog).getByRole("button", { name: /email me a sign-in link/i }),
    );

    await waitFor(() => {
      expect(requests.at(-1)?.url).toContain("magic-link");
    });
    expect(requests.at(-1)?.body).toMatchObject({ returnTo: "/me#me-account" });
  });

  it("gathers the local-data facts and controls into one group", async () => {
    await renderMe();

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

  it("has no Danger group, because there is no account to delete", async () => {
    await renderMe();

    expect(screen.queryByRole("region", { name: /danger/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/delete account/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /sign out/i })).not.toBeInTheDocument();
  });

  it("offers one Contribute entry, and it works", async () => {
    await renderMe();

    const contribute = region(/contribute/i);

    expect(
      within(contribute).getByRole("link", { name: /suggest a pen shop/i }),
    ).toHaveAttribute("href", "/suggest-shop");

    /*
     * The correction is still not here, and now for a stronger reason than when
     * the founder's staging review removed it. It exists and it works — on the
     * shop page, where the form carries the listing the reader came from. A
     * global Me row has no listing to carry.
     */
    expect(
      within(contribute).queryByText(/report incorrect information/i),
    ).not.toBeInTheDocument();
  });

  /*
   * The end of that reasoning: no row anywhere in Me carries "Not open yet".
   * Both rows that did are gone, and WP7 owns what replaces them.
   *
   * "Not available yet" is a different claim and stays — Sign in and Export
   * account data describe an account that will exist, which is product
   * information rather than a control that cannot be pressed.
   */
  it("carries no unusable controls at all", async () => {
    await renderMe({ collection: "seeded" });

    expect(screen.queryByText(/not open yet/i)).not.toBeInTheDocument();

    /*
     * "Help and about" is back, and so is the row it was named for. Revision 22
     * removed both because the help row carried *Not open yet* and a group
     * called "Help and about" with no help in it is the same inaccuracy one
     * level up. WP7 satisfies that reasoning rather than reversing it: the
     * heading is accurate because the help it names now exists and works.
     */
    const about = screen.getByRole("region", { name: /help and about/i });

    expect(within(about).getByRole("link", { name: /^help/i })).toHaveAttribute(
      "href",
      "/help",
    );
  });

  /** The three destinations that do work are untouched by the removals. */
  it("keeps every route that works", async () => {
    await renderMe();

    expect(screen.getByRole("link", { name: /privacy policy/i })).toHaveAttribute(
      "href",
      "/privacy",
    );
    expect(screen.getByRole("link", { name: /about nib atlas/i })).toHaveAttribute(
      "href",
      "/about",
    );
    expect(screen.getByRole("link", { name: /suggest a pen shop/i })).toHaveAttribute(
      "href",
      "/suggest-shop",
    );
    expect(screen.getByRole("link", { name: /^help/i })).toHaveAttribute("href", "/help");
  });

  /*
   * Me is where a person changes their own settings, and there is nothing here
   * to change. General statements about how the product behaves are not
   * personal settings; the section returns when real controls exist.
   */
  it("has no Preferences and accessibility section", async () => {
    await renderMe();

    expect(
      screen.queryByRole("region", { name: /preferences and accessibility/i }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/reduced-motion setting/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/no in-app override|reference only/i)).not.toBeInTheDocument();
  });

  /*
   * The founder's copy direction: the interface already says a link opens, a
   * button acts, a file downloads. Saying it again is noise.
   */
  it("does not narrate its own interaction mechanics", async () => {
    await renderMe({ collection: "seeded" });

    expect(screen.queryByText(/opens an email/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/exactly as they are stored here/i)).not.toBeInTheDocument();
  });

  /*
   * The copy corrections from the Codex review. Clearing removes two things; it
   * does not leave the device free of Nib Atlas, it does not touch preferences,
   * and removing the app from a home screen is not stated as deleting data —
   * that varies by platform and on several it does not.
   */
  it("does not overstate what the local-data controls cover", async () => {
    await renderMe({ collection: "seeded" });

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

  it("omits Places visited until there is something to point at", async () => {
    await renderMe();

    expect(
      screen.queryByRole("region", { name: /places visited/i }),
    ).not.toBeInTheDocument();
  });
});

describe("Me, places visited", () => {
  it("links each country and locality into the Passport", async () => {
    await renderMe({ collection: "seeded" });

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
  it("counts visits from stamps, and states seal progress separately", async () => {
    await renderMe({ collection: "seeded" });

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

  it("keeps the coverage-set version out of the product surface", async () => {
    await renderMe({ collection: "seeded" });

    expect(screen.queryByText(/curated set [a-z]{2}-/i)).not.toBeInTheDocument();
  });
});

describe("Me, local-data controls", () => {
  it("asks before clearing, and clears only when confirmed", async () => {
    await renderMe({ collection: "seeded" });

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

  it("hands over a file, named for the day it was taken", async () => {
    const created = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:nib-atlas");
    const revoked = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    // Stubbed rather than called through: jsdom has no download behaviour and
    // logs a navigation warning if the anchor is actually followed.
    const clicked = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});

    await renderMe({ collection: "seeded" });

    fireEvent.click(screen.getByRole("button", { name: /download local data/i }));

    expect(created).toHaveBeenCalledOnce();
    expect(clicked).toHaveBeenCalledOnce();
    expect(
      screen.getByRole("status", { name: /download local data result/i }),
    ).toHaveTextContent(/your data has been downloaded/i);

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
  it("keeps each result outside the button that produced it", async () => {
    await renderMe({ collection: "seeded" });

    const result = screen.getByRole("status", {
      name: /download local data result/i,
    });

    expect(result.closest("button")).toBeNull();
    expect(
      screen.getByRole("button", { name: /download local data/i }),
    ).not.toContainElement(result);
  });

  it("says so when the browser refuses the download", async () => {
    const created = vi.spyOn(URL, "createObjectURL").mockImplementation(() => {
      throw new Error("blocked");
    });

    await renderMe({ collection: "seeded" });

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
  it("holds Download and Clear until the device's state has been read", async () => {
    window.localStorage.setItem(
      COLLECTION_STORAGE_KEYS.normal,
      JSON.stringify({
        savedShopIds: prototypeSeedSavedShopIds,
        collections: prototypeSeedCollections,
      }),
    );

    const markup = renderToStaticMarkup(
      <WithAccount>
        <CollectionProvider>
          <MeScreen />
        </CollectionProvider>
      </WithAccount>,
    );

    const container = document.createElement("div");
    container.innerHTML = markup;

    const buttons = [...container.querySelectorAll("button")];
    const named = (label: RegExp) =>
      buttons.find((button) => label.test(button.textContent ?? ""));

    expect(named(/Download local data/)).toHaveAttribute("disabled");
    expect(named(/Clear data on this device/)).toHaveAttribute("disabled");
  });

  it("releases them once it has", async () => {
    await renderMe({ collection: "seeded" });

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
  it("opens with focus on Cancel, not on the destructive action", async () => {
    await renderMe({ collection: "seeded" });

    const trigger = screen.getByRole("button", { name: /clear data on this device/i });

    fireEvent.click(trigger);

    expect(screen.getByRole("button", { name: /^cancel$/i })).toHaveFocus();
    expect(screen.getByRole("button", { name: /^clear this device$/i })).not.toHaveFocus();
  });

  it("returns focus to the row when cancelled", async () => {
    await renderMe({ collection: "seeded" });

    const trigger = screen.getByRole("button", { name: /clear data on this device/i });

    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole("button", { name: /^cancel$/i }));

    expect(trigger).toHaveFocus();
  });

  it("returns focus to the row when the action goes through", async () => {
    await renderMe({ collection: "seeded" });

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
  it("survives two Enter presses in a row", async () => {
    await renderMe({ collection: "seeded" });

    const trigger = screen.getByRole("button", { name: /clear data on this device/i });

    trigger.focus();
    fireEvent.click(document.activeElement!);
    fireEvent.click(document.activeElement!);

    expect(trigger).toHaveFocus();
    expect(screen.getByRole("region", { name: /places visited/i })).toBeInTheDocument();
    expect(screen.queryByText(/cleared\./i)).not.toBeInTheDocument();
  });

  /*
   * Delete account is deliberately not one of these any more. Against a real
   * session, a confirmation whose confirm button signs the reader out and
   * leaves the account in place is worse than an unbuilt control, so the row
   * says what it is until Milestone 8 builds the deletion.
   */
  it("has no destructive confirmation it cannot honour", async () => {
    await renderMe({ session: { kind: "signed-in" } });

    expect(
      screen.queryByRole("button", { name: /delete account/i }),
    ).not.toBeInTheDocument();
    expect(region(/^danger$/i)).toHaveTextContent("Delete account");
  });
});

describe("Me, the signed-in structure", () => {
  it("shows the account, its identity, and the controls that exist", async () => {
    await renderMe({ session: { kind: "signed-in" } });

    const account = region(/^account$/i);

    // With no display name chosen the address is the headline, and printing it
    // twice would read as a defect rather than as a second fact.
    expect(within(account).getAllByText(SESSION_IDENTITY)).toHaveLength(1);
    expect(within(account).queryByText(/reviewer preview/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sign out/i })).toBeInTheDocument();
    expect(within(region(/^danger$/i)).getByText("Delete account")).toBeInTheDocument();
  });

  it("puts a chosen display name above the address", async () => {
    await renderMe({ session: { kind: "signed-in", displayName: "Ada Lovelace" } });

    const account = region(/^account$/i);

    expect(within(account).getByText("Ada Lovelace")).toBeInTheDocument();
    expect(within(account).getByText(SESSION_IDENTITY)).toBeInTheDocument();
  });

  /*
   * WP2 gives the interface a profile read and no profile write. The form this
   * replaced had a Save button with nothing to call, so the row states the fact
   * in the same form the rest of Me uses for something that does not exist yet.
   */
  it("does not offer a display-name form it cannot save", async () => {
    await renderMe({ session: { kind: "signed-in" } });

    expect(screen.queryByLabelText(/display name/i)).not.toBeInTheDocument();
    expect(region(/^account$/i)).toHaveTextContent("Display name");
    expect(region(/^account$/i)).toHaveTextContent("Not available yet");
  });

  /*
   * Signing in establishes an identity and nothing else yet: the saved-shop
   * endpoints are WP4 and the import is WP5. A signed-in reader is told that
   * rather than left to assume their saves have moved.
   */
  it("says that saves and impressions are still device-local", async () => {
    await renderMe({ session: { kind: "signed-in" }, collection: "seeded" });

    const data = region(/privacy and your data/i);

    expect(data).toHaveTextContent(/do not sync yet/i);
    expect(
      within(data).getByRole("button", { name: /download local data/i }),
    ).toBeInTheDocument();
  });

  it("ends the session through the server, then shows the signed-out structure", async () => {
    const { requests } = await renderMe({ session: { kind: "signed-in" } });

    fireEvent.click(screen.getByRole("button", { name: /sign out/i }));

    await waitFor(() => {
      expect(
        within(region(/^account$/i)).getByRole("button", { name: /sign in/i }),
      ).toBeInTheDocument();
    });

    expect(
      requests.some(
        (request) =>
          request.url.includes("/api/v1/auth/sign-out") && request.method === "POST",
      ),
    ).toBe(true);
    expect(screen.queryByRole("region", { name: /^danger$/i })).not.toBeInTheDocument();
  });

  it("keeps the reader signed in, and says so, when sign-out fails", async () => {
    seedReviewerMode(false);
    installAuthFetch({ session: { kind: "signed-in" }, signOut: { status: 502 } });

    render(
      <WithAccount>
        <CollectionProvider>
          <MeScreen />
        </CollectionProvider>
      </WithAccount>,
    );

    const signOut = await screen.findByRole("button", { name: /sign out/i });

    fireEvent.click(signOut);

    expect(await screen.findByText(/you are still signed in/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sign out/i })).toBeInTheDocument();
  });
});

describe("Me, the states a network answer adds", () => {
  /*
   * Loading is not rendered as signed out. The session is behind an HTTP-only
   * cookie, so the browser has to ask — and flashing "Sign in" at a reader who
   * has an account on every visit to this page is the defect that would cause.
   */
  it("says it is checking, and claims neither state, while the session is read", async () => {
    await renderMe({ session: { kind: "pending" } });

    expect(screen.getByText(/checking your account/i)).toBeInTheDocument();
    expect(
      within(region(/^account$/i)).queryByRole("button", { name: /sign in/i }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: /^danger$/i })).not.toBeInTheDocument();
  });

  /*
   * A build with no authentication behind it cannot offer sign-in, and says so
   * rather than presenting a control that would fail. This is the state the
   * fixture builds and the current staging deployment are actually in.
   */
  it("does not offer sign-in in a build that has no accounts", async () => {
    await renderMe({ session: { kind: "not-configured" } });

    const account = region(/^account$/i);

    expect(within(account).queryByRole("button", { name: /sign in/i })).not.toBeInTheDocument();
    expect(account).toHaveTextContent(/not available in this build/i);
    // And it does not overstate the loss: everything else still works.
    expect(account).toHaveTextContent(/saving shops on this device/i);
  });

  it("names the milestone behind that, for reviewers only", async () => {
    await renderMe({ reviewer: true, session: { kind: "not-configured" } });

    expect(region(/^account$/i)).toHaveTextContent(/WP6/);
  });

  /** A configured build that did not answer is worth trying again, and offers it. */
  it("offers a retry when the session could not be read", async () => {
    const { requests } = await renderMe({ session: { kind: "unreachable" } });
    const reads = () =>
      requests.filter((request) => request.url.includes("/api/v1/auth/session")).length;
    const before = reads();

    expect(screen.getByRole("alert")).toHaveTextContent(/could not check your account/i);

    fireEvent.click(screen.getByRole("button", { name: /try again/i }));

    await waitFor(() => {
      expect(reads()).toBeGreaterThan(before);
    });
  });
});
