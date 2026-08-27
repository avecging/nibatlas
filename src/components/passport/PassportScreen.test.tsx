import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PassportPageView } from "@/src/components/passport/PassportPageView";
import { PassportScreen, type PassportTarget } from "@/src/components/passport/PassportScreen";
import { buildPassport } from "@/src/domain/passport";
import { deriveSeals } from "@/src/domain/seals";
import { designSeal, prototypeCoverageSets } from "@/src/fixtures/prototype-catalogue";
import {
  buildPassportPages,
  IDENTITY_PAGE_INDEX,
} from "@/src/features/passport/passport-pages";
import { AccountSessionProvider } from "@/src/features/account/AccountSessionProvider";
import { ACCOUNT_PREVIEW_STORAGE_KEY } from "@/src/features/account/account-session";
import {
  COLLECTION_STORAGE_KEYS,
  CollectionProvider,
} from "@/src/features/collection/collection-store";
import {
  PASSPORT_VIEW_STORAGE_KEYS,
  parsePassportView,
  serializePassportView,
  type PassportViewRecord,
} from "@/src/features/passport/passport-view-state";
import {
  prototypeSeedCollections,
  prototypeSeedSavedShopIds,
} from "@/src/fixtures/prototype-passport";
import { seedReviewerMode, WithReviewerMode } from "@/src/test/reviewer";

/**
 * The Passport screen as structure.
 *
 * The properties under test are the ones a reviewer cannot read off the diff:
 * which mode a clean device of each audience lands in, that a default is never
 * written down as a choice, that the two audiences' records cannot reach each
 * other, and that the enlarged stamp behaves as a modal dialog.
 *
 * Journeys across a reload and a navigation are in `tests/e2e/passport.spec.ts`;
 * this file is about the resolution rules at one render.
 */
function seed({
  reviewer = false,
  collection,
  view,
  signedInAs,
}: {
  readonly reviewer?: boolean;
  readonly collection?: "seeded" | undefined;
  readonly view?: Partial<PassportViewRecord> | string | undefined;
  readonly signedInAs?: string | null | undefined;
} = {}) {
  seedReviewerMode(reviewer);
  const scope = reviewer ? "reviewer" : "normal";

  if (collection === "seeded") {
    window.localStorage.setItem(
      COLLECTION_STORAGE_KEYS[scope],
      JSON.stringify({
        savedShopIds: prototypeSeedSavedShopIds,
        collections: prototypeSeedCollections,
      }),
    );
  } else {
    // Written as empty rather than left absent: an absent reviewer key means
    // "seeded baseline", which would defeat the point of an empty-state test.
    window.localStorage.setItem(
      COLLECTION_STORAGE_KEYS[scope],
      JSON.stringify({ savedShopIds: [], collections: [] }),
    );
  }

  if (view !== undefined) {
    window.localStorage.setItem(
      PASSPORT_VIEW_STORAGE_KEYS[scope],
      typeof view === "string"
        ? view
        : serializePassportView({
            mode: null,
            coverSeen: false,
            place: null,
            listScrollTop: 0,
            ...view,
          }),
    );
  }

  if (signedInAs !== undefined) {
    window.localStorage.setItem(
      ACCOUNT_PREVIEW_STORAGE_KEY,
      JSON.stringify({ signedIn: true, displayName: signedInAs }),
    );
  }
}

function Passport({ target = { kind: "all" } }: { readonly target?: PassportTarget }) {
  return (
    <WithReviewerMode>
      <AccountSessionProvider>
        <CollectionProvider>
          <PassportScreen target={target} />
        </CollectionProvider>
      </AccountSessionProvider>
    </WithReviewerMode>
  );
}

async function renderPassport(target: PassportTarget = { kind: "all" }) {
  render(
    <WithReviewerMode>
      <AccountSessionProvider>
        <CollectionProvider>
          <PassportScreen target={target} />
        </CollectionProvider>
      </AccountSessionProvider>
    </WithReviewerMode>,
  );

  // The device's own state resolves after mount, so every assertion waits for
  // the toggle rather than reading the settling frame.
  await waitFor(() =>
    expect(screen.getByRole("group", { name: /passport view/i })).toBeInTheDocument(),
  );
}

function toggle() {
  return screen.getByRole("group", { name: /passport view/i });
}

function pressed() {
  return within(toggle())
    .getAllByRole("button")
    .filter((button) => button.getAttribute("aria-pressed") === "true")
    .map((button) => button.textContent);
}

function storedView(scope: "normal" | "reviewer" = "normal") {
  return parsePassportView(
    window.localStorage.getItem(PASSPORT_VIEW_STORAGE_KEYS[scope]),
  );
}

describe("Passport mode defaults", () => {
  it("puts List on the left and Book on the right", async () => {
    seed({ collection: "seeded" });
    await renderPassport();

    const labels = within(toggle())
      .getAllByRole("button")
      .map((button) => button.textContent);

    expect(labels).toEqual(["List", "Book"]);
  });

  it("defaults a clean normal device to List", async () => {
    seed();
    await renderPassport();

    expect(pressed()).toEqual(["List"]);
  });

  it("defaults a clean reviewer device to Book", async () => {
    seed({ reviewer: true, collection: "seeded" });
    await renderPassport();

    expect(pressed()).toEqual(["Book"]);
  });

  it("does not write the default down as a choice", async () => {
    seed({ collection: "seeded" });
    await renderPassport();

    // Nothing has been chosen, so there is nothing to remember. A stored "list"
    // here would make the reviewer default unreachable for ever after.
    expect(window.localStorage.getItem(PASSPORT_VIEW_STORAGE_KEYS.normal)).toBeNull();
  });

  it("records an explicit choice, and honours it over the default", async () => {
    seed({ collection: "seeded" });
    await renderPassport();

    fireEvent.click(within(toggle()).getByRole("button", { name: "Book" }));

    expect(pressed()).toEqual(["Book"]);
    expect(storedView().mode).toBe("book");
  });

  it("honours a stored choice that contradicts the audience default", async () => {
    seed({ reviewer: true, collection: "seeded", view: { mode: "list" } });
    await renderPassport();

    expect(pressed()).toEqual(["List"]);
  });

  it("falls back to the default when the stored record is nonsense", async () => {
    seed({ reviewer: true, collection: "seeded", view: "{{ not json" });
    await renderPassport();

    expect(pressed()).toEqual(["Book"]);
  });

  it("keeps the two audiences' records apart", async () => {
    seed({ reviewer: true, collection: "seeded" });
    await renderPassport();

    fireEvent.click(within(toggle()).getByRole("button", { name: "List" }));

    expect(storedView("reviewer").mode).toBe("list");
    // The tester's own device is untouched, so it still gets its own default.
    expect(window.localStorage.getItem(PASSPORT_VIEW_STORAGE_KEYS.normal)).toBeNull();
  });
});

describe("List mode", () => {
  it("reports stamps, countries and localities from the collection", async () => {
    seed({ collection: "seeded" });
    await renderPassport();

    const stamps = screen.getByText("Shop stamps").parentElement;
    const countries = screen.getByText("Countries visited").parentElement;
    const localities = screen.getByText("Localities visited").parentElement;

    expect(stamps?.textContent).toContain(String(prototypeSeedCollections.length));
    expect(countries?.textContent).toContain("3");
    expect(localities?.textContent).toContain("5");
  });

  it("keeps the country seal separate from the countries visited", async () => {
    seed({ collection: "seeded" });
    await renderPassport();

    // Three countries are visited; only Singapore's seal is earned. A seal
    // standing in for a visit would hide Japan and Taiwan.
    expect(screen.getByRole("link", { name: /japan/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /taiwan/i })).toBeInTheDocument();
    expect(
      screen.getAllByRole("img", { name: /country stamp/i }).length,
    ).toBe(1);
  });

  it("links every country and locality to its own route", async () => {
    seed({ collection: "seeded" });
    await renderPassport();

    expect(screen.getByRole("link", { name: /japan/i })).toHaveAttribute(
      "href",
      "/passport/jp",
    );
    expect(screen.getByRole("link", { name: /chūō, tokyo/i })).toHaveAttribute(
      "href",
      "/passport/jp/chuo-tokyo",
    );
  });

  it("groups deterministically and orders impressions newest first", async () => {
    seed({ collection: "seeded" });
    await renderPassport();

    const countries = screen
      .getAllByRole("heading", { level: 2 })
      .map((heading) => heading.textContent);

    expect(countries).toEqual(["Japan", "Singapore", "Taiwan"]);

    const localities = screen
      .getAllByRole("heading", { level: 3 })
      .map((heading) => heading.textContent);

    expect(localities).toEqual([
      "Chūō, Tokyo",
      "Naka, Yokohama",
      "Singapore",
      "East District, Tainan",
      "Kaohsiung",
    ]);

    // Every impression is a row, and Singapore's two are newest first.
    const rows = screen
      .getAllByRole("button")
      .map((button) => button.textContent ?? "")
      .filter((text) => /2026-/.test(text));

    expect(rows).toHaveLength(prototypeSeedCollections.length);
    expect(rows[2]).toContain("2026-06-03");
    expect(rows[3]).toContain("2026-06-02");
  });

  it("narrows to one country on the country route", async () => {
    seed({ collection: "seeded" });
    await renderPassport({ kind: "country", country: "jp" });

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Japan");
    expect(screen.queryByText("Singapore")).not.toBeInTheDocument();
  });

  it("narrows to one locality on the locality route", async () => {
    seed({ collection: "seeded" });
    await renderPassport({
      kind: "locality",
      country: "jp",
      locality: "chuo-tokyo",
    });

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Chūō, Tokyo");
    expect(screen.getByRole("link", { name: "Japan" })).toHaveAttribute(
      "href",
      "/passport/jp",
    );
  });
});

describe("a stale or invalid destination", () => {
  it("says so rather than rendering an empty country", async () => {
    seed({ collection: "seeded" });
    render(
      <WithReviewerMode>
        <AccountSessionProvider>
          <CollectionProvider>
            <PassportScreen target={{ kind: "country", country: "xx" }} />
          </CollectionProvider>
        </AccountSessionProvider>
      </WithReviewerMode>,
    );

    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: /nothing collected in this country/i }),
      ).toBeInTheDocument(),
    );
    expect(screen.getByRole("link", { name: /open passport/i })).toHaveAttribute(
      "href",
      "/passport",
    );
  });

  it("says so for a locality the country does not hold", async () => {
    seed({ collection: "seeded" });
    render(
      <WithReviewerMode>
        <AccountSessionProvider>
          <CollectionProvider>
            <PassportScreen
              target={{ kind: "locality", country: "jp", locality: "nowhere" }}
            />
          </CollectionProvider>
        </AccountSessionProvider>
      </WithReviewerMode>,
    );

    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: /nothing collected in this locality/i }),
      ).toBeInTheDocument(),
    );
  });
});

describe("the empty normal state", () => {
  it("says nothing has been collected and offers the map", async () => {
    seed();
    await renderPassport();

    expect(
      screen.getByRole("heading", { name: /no stamps collected yet/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /explore the map/i })).toHaveAttribute(
      "href",
      "/",
    );
  });

  it("contains no seeded personal history", async () => {
    seed();
    await renderPassport();

    // The Milestone 1 seed's own dates and shops, none of which this device has.
    expect(screen.queryByText(/2026-03-14/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Ginza/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Japan/)).not.toBeInTheDocument();
  });
});

describe("the enlarged stamp", () => {
  async function openFirstStamp() {
    seed({ collection: "seeded" });
    await renderPassport();

    const opener = screen
      .getAllByRole("button")
      .find((button) => /2026-/.test(button.textContent ?? ""));

    opener?.focus();
    fireEvent.click(opener as HTMLElement);

    return opener as HTMLElement;
  }

  it("opens as a named modal dialog carrying what the impression records", async () => {
    await openFirstStamp();

    const dialog = screen.getByRole("dialog");

    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAccessibleName();
    expect(within(dialog).getByText("Shop stamp")).toBeInTheDocument();
    expect(within(dialog).getByText("Locality")).toBeInTheDocument();
    expect(within(dialog).getByText("Country")).toBeInTheDocument();
    expect(within(dialog).getByText("Collected")).toBeInTheDocument();
  });

  it("carries the Passport route through to the shop", async () => {
    await openFirstStamp();

    const link = within(screen.getByRole("dialog")).getByRole("link", {
      name: /open shop/i,
    });

    expect(link.getAttribute("href")).toContain("from=passport");
    expect(link.getAttribute("href")).toContain(
      `back=${encodeURIComponent("/passport")}`,
    );
  });

  it("closes on Escape and returns focus to the stamp that opened it", async () => {
    const opener = await openFirstStamp();

    fireEvent.keyDown(document, { key: "Escape" });

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(document.activeElement).toBe(opener);
  });

  it("closes on its own control and returns focus", async () => {
    const opener = await openFirstStamp();

    fireEvent.click(screen.getByRole("button", { name: /close stamp/i }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(document.activeElement).toBe(opener);
  });
});

/**
 * Another tab writing to the same record.
 *
 * `localStorage` is shared, and a `storage` event is what a browser sends to the
 * tabs that did *not* make the change. jsdom fires no such event of its own, so
 * the two halves are separated deliberately here: `writeElsewhere` is a change
 * this tab has not been told about, and `announceElsewhere` is the notification.
 */
function writeElsewhere(
  record: Partial<PassportViewRecord>,
  scope: "normal" | "reviewer" = "normal",
) {
  window.localStorage.setItem(
    PASSPORT_VIEW_STORAGE_KEYS[scope],
    serializePassportView({
      mode: null,
      coverSeen: false,
      place: null,
      listScrollTop: 0,
      ...record,
    }),
  );
}

function announceElsewhere(scope: "normal" | "reviewer" = "normal") {
  const key = PASSPORT_VIEW_STORAGE_KEYS[scope];

  window.dispatchEvent(
    new StorageEvent("storage", {
      key,
      newValue: window.localStorage.getItem(key),
      storageArea: window.localStorage,
    }),
  );
}

describe("two tabs on one record", () => {
  it("adopts a mode chosen in another tab", async () => {
    seed({ collection: "seeded" });
    await renderPassport();

    expect(pressed()).toEqual(["List"]);

    writeElsewhere({ mode: "book" });
    announceElsewhere();

    await waitFor(() => expect(pressed()).toEqual(["Book"]));
  });

  it("adopts an opened cover without springing the book open", async () => {
    seed({ collection: "seeded", view: { mode: "book" } });
    const first = render(<Passport />);

    await waitFor(() => expect(toggle()).toBeInTheDocument());
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /open passport/i })).toBeInTheDocument(),
    );

    writeElsewhere({ mode: "book", coverSeen: true });
    announceElsewhere();

    // The cover stays put. Another tab opening its own book is not a reason for
    // this page to move under the reader.
    await waitFor(() => expect(storedView().coverSeen).toBe(true));
    expect(
      screen.getByRole("button", { name: /open passport/i }),
    ).toBeInTheDocument();

    // But the fact was adopted, so the next visit does not ask again.
    first.unmount();
    render(<Passport />);

    await waitFor(() => expect(toggle()).toBeInTheDocument());
    expect(
      screen.queryByRole("button", { name: /open passport/i }),
    ).not.toBeInTheDocument();
  });

  it("ignores the other audience's key", async () => {
    seed({ collection: "seeded" });
    await renderPassport();

    writeElsewhere({ mode: "book" }, "reviewer");
    announceElsewhere("reviewer");

    // Still this device's own default, and its own record is still untouched.
    await waitFor(() => expect(pressed()).toEqual(["List"]));
    expect(window.localStorage.getItem(PASSPORT_VIEW_STORAGE_KEYS.normal)).toBeNull();
  });

  it("does not erase a field it was never told about", async () => {
    seed({ collection: "seeded", view: { mode: "book" } });
    await renderPassport();

    // Another tab records a scroll offset and a place. This tab is deliberately
    // not told, so its in-memory record is now stale — the exact state in which
    // Milestone 1.5's first WP3 implementation clobbered the other tab's work.
    writeElsewhere({
      mode: "book",
      listScrollTop: 999,
      place: { kind: "seals" },
    });

    // Now this tab writes something unrelated.
    fireEvent.click(screen.getByRole("button", { name: /open passport/i }));

    await waitFor(() => expect(storedView().coverSeen).toBe(true));

    const after = storedView();

    expect(after.listScrollTop).toBe(999);
    expect(after.mode).toBe("book");
    // `place` is the one field the book itself owns, so it is allowed to move —
    // but only to a real page, never back to null.
    expect(after.place).not.toBeNull();
  });

  it("keeps an opened cover opened when a stale tab writes", async () => {
    seed({ collection: "seeded", view: { mode: "book", coverSeen: true } });
    await renderPassport();

    // A tab that still believes the cover is closed writes a scroll offset.
    writeElsewhere({ mode: "book", coverSeen: false, listScrollTop: 120 });

    fireEvent.click(within(toggle()).getByRole("button", { name: "List" }));

    await waitFor(() => expect(storedView().mode).toBe("list"));
    expect(storedView().coverSeen).toBe(true);
  });

  it("resolves a cleared storage area to nothing remembered", async () => {
    seed({ collection: "seeded", view: { mode: "book" } });
    await renderPassport();

    expect(pressed()).toEqual(["Book"]);

    window.localStorage.clear();
    window.dispatchEvent(
      new StorageEvent("storage", { key: null, storageArea: window.localStorage }),
    );

    // Back to the audience default, not to an error.
    await waitFor(() => expect(pressed()).toEqual(["List"]));
  });
});

describe("the identity page", () => {
  /*
   * Rendered on its own rather than through the book.
   *
   * The book paints only the spread that is showing, and the routine landing
   * spread is deliberately not the identity page — that is the point of WP3's
   * page order. Reaching it through the pager would make this a test of the
   * pager. `buildPassportPages` carrying the name is covered in
   * `passport-pages.test.ts`; what matters here is what the page renders.
   */
  function renderIdentity(displayName: string | null) {
    const passport = buildPassport(prototypeSeedCollections);
    const { seals, countryProgress } = deriveSeals({
      collections: prototypeSeedCollections,
      coverageSets: prototypeCoverageSets,
      designSeal,
    });
    const page = buildPassportPages({
      passport,
      seals,
      countryProgress,
      displayName,
    })[IDENTITY_PAGE_INDEX];

    render(
      <WithReviewerMode>
        <PassportPageView
          headingId="identity-heading"
          onJumpToPage={() => {}}
          onSelectStamp={() => {}}
          page={page!}
        />
      </WithReviewerMode>,
    );
  }

  it("shows the display name from the account seam", () => {
    renderIdentity("Ada Lovelace");

    expect(screen.getByRole("heading", { level: 3 })).toHaveTextContent(
      "Ada Lovelace",
    );
  });

  it("falls back to Your Passport, never to an address", () => {
    renderIdentity(null);

    expect(screen.getByRole("heading", { level: 3 })).toHaveTextContent(
      "Your Passport",
    );
    expect(screen.queryByText(/@/)).not.toBeInTheDocument();
  });

  it("reports the collection's own counts", () => {
    renderIdentity(null);

    expect(screen.getByText("Shop stamps").parentElement?.textContent).toContain(
      String(prototypeSeedCollections.length),
    );
  });
});
