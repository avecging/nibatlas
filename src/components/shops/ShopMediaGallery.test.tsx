import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ShopLogoMark } from "./ShopLogoMark";
import { ShopMediaGallery } from "./ShopMediaGallery";
import { ShopMediaProvider } from "./ShopMediaProvider";

/**
 * The public media surface: one read, split into identity and photographs.
 *
 * Issue #82 asks for a contained gallery in place of a vertical stack, and the
 * shop UI brief adds the rules the stack never had to keep: the business's logo
 * is identity rather than a picture, the count is taken from the list, server
 * order decides the cover, and an enlarged viewer has to be usable from a
 * keyboard. These are those rules.
 */
const SHOP = "84000000-0000-4000-8000-000000000000";

function id(n: number): string {
  return `84000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
}

function photo(n: number, overrides: Record<string, unknown> = {}) {
  return {
    id: id(n),
    kind: "photo",
    width: 1200,
    height: 800,
    altText: `Photo ${n} of the shop`,
    creditText: null,
    ...overrides,
  };
}

function serveMedia(entries: readonly unknown[]) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => Response.json({ entries })),
  );
}

function renderMedia(entries: readonly unknown[], shopId = SHOP) {
  serveMedia(entries);

  return render(
    <ShopMediaProvider shopId={shopId}>
      <ShopLogoMark />
      <ShopMediaGallery shopName="Ginza Itoya Main Store" />
    </ShopMediaProvider>,
  );
}

/** The gallery renders nothing at all outside an API-backed build. */
beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_CATALOGUE_MODE", "api-demo");
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("the shop logo", () => {
  it("is drawn in the identity header and never counted as a photograph", async () => {
    renderMedia([
      photo(1, { kind: "logo", width: 512, height: 512, altText: "Itoya logo" }),
      photo(2),
    ]);

    const logo = await screen.findByAltText("Itoya logo");

    expect(logo).toHaveAttribute("src", `/api/v1/shops/${SHOP}/media/${id(1)}`);
    expect(logo.parentElement).toHaveAttribute("data-shape", "square");

    // One photo plus a logo is one photo: no counter and no overflow control.
    const gallery = await screen.findByRole("region", {
      name: "Photos of Ginza Itoya Main Store",
    });

    expect(within(gallery).getAllByRole("button")).toHaveLength(1);
    expect(within(gallery).queryByText(/View all/)).not.toBeInTheDocument();
    expect(within(gallery).queryByText(/1 \//)).not.toBeInTheDocument();
  });

  it("gives a wide wordmark the wide slot, at its own proportions", async () => {
    renderMedia([photo(1, { kind: "logo", width: 1600, height: 400, altText: "Wordmark" })]);

    const logo = await screen.findByAltText("Wordmark");

    expect(logo.parentElement).toHaveAttribute("data-shape", "wide");
    // The source image is preserved; nothing here crops or stretches it.
    expect(logo).toHaveAttribute("width", "1600");
    expect(logo).toHaveAttribute("height", "400");
  });

  it("leaves a text-led identity when there is no logo, and when one will not load", async () => {
    const { rerender } = renderMedia([photo(1)]);

    await screen.findByRole("region", { name: "Photos of Ginza Itoya Main Store" });
    expect(screen.queryByAltText(/logo/i)).not.toBeInTheDocument();

    serveMedia([photo(2, { kind: "logo", width: 512, height: 512, altText: "Broken logo" })]);
    rerender(
      <ShopMediaProvider shopId={id(9)}>
        <ShopLogoMark />
        <ShopMediaGallery shopName="Ginza Itoya Main Store" />
      </ShopMediaProvider>,
    );

    const logo = await screen.findByAltText("Broken logo");

    fireEvent.error(logo);

    expect(screen.queryByAltText("Broken logo")).not.toBeInTheDocument();
  });
});

describe("the contained gallery", () => {
  it("shows a cover and two previews, and counts the rest from the list", async () => {
    renderMedia(Array.from({ length: 12 }, (_, index) => photo(index + 1)));

    const gallery = await screen.findByRole("region", {
      name: "Photos of Ginza Itoya Main Store",
    });

    // Three tiles, not twelve full-width figures.
    expect(within(gallery).getAllByRole("listitem")).toHaveLength(3);
    expect(
      within(gallery).getByRole("button", { name: "View all 12 photos" }),
    ).toBeInTheDocument();
    expect(within(gallery).getByText("1 / 12")).toBeInTheDocument();
  });

  it("opens a tile at the photograph that was pressed, in server order", async () => {
    renderMedia([photo(3), photo(1), photo(2)]);

    const gallery = await screen.findByRole("region", {
      name: "Photos of Ginza Itoya Main Store",
    });
    const tiles = within(gallery).getAllByRole("button");

    expect(tiles[0]).toHaveAccessibleName("Open photo 1 of 3: Photo 3 of the shop");

    fireEvent.click(tiles[1]!);

    expect(await screen.findByText("Photo 2 of 3")).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toContainElement(
      screen.getByAltText("Photo 1 of the shop"),
    );
  });

  it("lays two photographs out without a third empty slot", async () => {
    renderMedia([photo(1), photo(2)]);

    const gallery = await screen.findByRole("region", {
      name: "Photos of Ginza Itoya Main Store",
    });

    expect(within(gallery).getAllByRole("listitem")).toHaveLength(2);
    expect(within(gallery).getByText("1 / 2")).toBeInTheDocument();
    expect(within(gallery).queryByText(/View all/)).not.toBeInTheDocument();
  });

  it("credits every photograph it is showing, and names a photographer once", async () => {
    renderMedia([
      photo(1, { creditText: "First photographer" }),
      photo(2, { creditText: "Second photographer" }),
      photo(3, { creditText: "Second photographer" }),
      photo(4, { creditText: "Unshown photographer" }),
    ]);

    const gallery = await screen.findByRole("region", {
      name: "Photos of Ginza Itoya Main Store",
    });

    expect(gallery).toHaveTextContent("First photographer · Second photographer");
    // A credit for a photograph nobody can see here is not an attribution.
    expect(gallery).not.toHaveTextContent("Unshown photographer");
  });

  it("offers no overflow control when everything published is already on screen", async () => {
    renderMedia([photo(1), photo(2), photo(3)]);

    const gallery = await screen.findByRole("region", {
      name: "Photos of Ginza Itoya Main Store",
    });

    expect(within(gallery).getAllByRole("listitem")).toHaveLength(3);
    expect(within(gallery).queryByText(/View all/)).not.toBeInTheDocument();
  });

  it("renders no gallery and no count for a shop with no photographs", async () => {
    renderMedia([photo(1, { kind: "logo", width: 512, height: 512, altText: "Only a logo" })]);

    await screen.findByAltText("Only a logo");

    expect(
      screen.queryByRole("region", { name: "Photos of Ginza Itoya Main Store" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/photos/i)).not.toBeInTheDocument();
  });

  it("carries the cover's caption and supplied credit as text beside the image", async () => {
    const caption = "墨水 <script>window.__captionExecuted=true</script>";

    const { container } = renderMedia([
      photo(1, { caption, creditText: "Existing photographer" }),
      photo(2),
    ]);

    expect(await screen.findByText(caption)).toBeInTheDocument();
    expect(screen.getByText("Existing photographer")).toBeInTheDocument();
    expect(container.querySelector("script")).toBeNull();
  });

  it("distinguishes loading, failure and emptiness", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(new Response("", { status: 503 }))
        .mockResolvedValueOnce(Response.json({ entries: [] })),
    );

    render(
      <ShopMediaProvider shopId={SHOP}>
        <ShopMediaGallery shopName="Ginza Itoya Main Store" />
      </ShopMediaProvider>,
    );

    expect(screen.getByTestId("shop-gallery-loading")).toBeInTheDocument();

    fireEvent.click(await screen.findByRole("button", { name: "Retry images" }));

    // The recovered read has no photographs, which is silence rather than a
    // fabricated gallery.
    await waitFor(() =>
      expect(screen.queryByTestId("shop-gallery-failed")).not.toBeInTheDocument(),
    );
    expect(
      screen.queryByRole("region", { name: "Photos of Ginza Itoya Main Store" }),
    ).not.toBeInTheDocument();
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("asks for nothing at all where there is no public media route", () => {
    vi.stubEnv("NEXT_PUBLIC_CATALOGUE_MODE", "fixture");
    serveMedia([photo(1)]);

    render(
      <ShopMediaProvider shopId="shop-jp-ginza-itoya-main">
        <ShopMediaGallery shopName="Ginza Itoya Main Store" />
      </ShopMediaProvider>,
    );

    expect(fetch).not.toHaveBeenCalled();
    expect(screen.queryByTestId("shop-gallery-loading")).not.toBeInTheDocument();
  });

  it("never shows another shop's photographs after a navigation", async () => {
    const { rerender } = renderMedia([photo(1, { altText: "First shop" })]);

    await screen.findByAltText("");
    serveMedia([photo(2, { altText: "Second shop" })]);

    rerender(
      <ShopMediaProvider shopId={id(7)}>
        <ShopMediaGallery shopName="Second Shop" />
      </ShopMediaProvider>,
    );

    // The previous shop's list is dropped on the way out, not left on screen.
    expect(screen.getByTestId("shop-gallery-loading")).toBeInTheDocument();
    await screen.findByRole("region", { name: "Photos of Second Shop" });
  });
});

describe("the enlarged viewer", () => {
  async function openViewer(count = 12) {
    renderMedia(Array.from({ length: count }, (_, index) => photo(index + 1)));

    const gallery = await screen.findByRole("region", {
      name: "Photos of Ginza Itoya Main Store",
    });
    const cover = within(gallery).getAllByRole("button")[0]!;

    cover.focus();
    fireEvent.click(cover);

    return { cover, dialog: screen.getByRole("dialog") };
  }

  it("states the position in the set and moves through it with the arrow keys", async () => {
    await openViewer();

    expect(screen.getByText("Photo 1 of 12")).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "ArrowRight" });
    expect(screen.getByText("Photo 2 of 12")).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "ArrowLeft" });
    expect(screen.getByText("Photo 1 of 12")).toBeInTheDocument();

    // It does not wrap past the ends, and says so on the control.
    fireEvent.keyDown(document, { key: "ArrowLeft" });
    expect(screen.getByText("Photo 1 of 12")).toBeInTheDocument();

    // Marked unavailable rather than removed from the tab order: a control that
    // disables itself under the finger that pressed it drops keyboard focus.
    const previous = screen.getByRole("button", { name: "Previous photo" });

    expect(previous).toHaveAttribute("aria-disabled", "true");

    previous.focus();
    fireEvent.click(previous);

    expect(screen.getByText("Photo 1 of 12")).toBeInTheDocument();
    expect(document.activeElement).toBe(previous);
  });

  it("downloads the photograph being read and its two neighbours, not the set", async () => {
    await openViewer();

    const before = screen.getByRole("dialog").querySelector(`img[src$="${id(2)}"]`);

    fireEvent.click(screen.getByRole("button", { name: "Next photo" }));

    const dialog = screen.getByRole("dialog");

    expect(dialog.querySelectorAll("img")).toHaveLength(3);
    expect(within(dialog).getByAltText("Photo 2 of the shop")).toBeInTheDocument();

    /*
     * The same element, not a replacement for it. The media route is
     * `no-store`, so a fresh element would re-request the photograph the
     * neighbour slot had already fetched — and re-run its publication check.
     */
    expect(dialog.querySelector(`img[src$="${id(2)}"]`)).toBe(before);
  });

  it("keeps the whole set out of the accessibility tree while one is read", async () => {
    await openViewer();

    const dialog = screen.getByRole("dialog");

    expect(dialog.querySelectorAll('img:not([aria-hidden="true"])')).toHaveLength(1);
  });

  it("closes on Escape and returns focus to the tile that opened it", async () => {
    const { cover } = await openViewer(4);

    fireEvent.keyDown(document, { key: "Escape" });

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(document.activeElement).toBe(cover);
  });

  it("closes from its own control, and locks the page behind it while open", async () => {
    await openViewer(4);

    expect(document.body.style.overflow).toBe("hidden");

    fireEvent.click(screen.getByRole("button", { name: "Close photos" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(document.body.style.overflow).not.toBe("hidden");
  });

  it("opens at the first unseen photograph from the overflow control", async () => {
    renderMedia(Array.from({ length: 12 }, (_, index) => photo(index + 1)));

    fireEvent.click(await screen.findByRole("button", { name: "View all 12 photos" }));

    expect(screen.getByText("Photo 4 of 12")).toBeInTheDocument();
  });

  it("says a photograph could not be loaded rather than showing a broken frame", async () => {
    await openViewer(4);

    fireEvent.error(screen.getByAltText("Photo 1 of the shop"));

    expect(screen.getByText("This photo could not be loaded.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next photo" })).toBeEnabled();
  });

  it("gives a single photograph no next or previous controls", async () => {
    await openViewer(1);

    expect(screen.getByText("Photo 1 of 1")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Next photo" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Previous photo" })).not.toBeInTheDocument();
  });
});
