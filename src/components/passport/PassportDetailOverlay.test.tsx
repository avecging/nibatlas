import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  impressionSubject,
  PassportDetailOverlay,
  sealSubject,
} from "@/src/components/passport/PassportDetailOverlay";
import type { StampCollection } from "@/src/domain/passport";
import type { EarnedSeal } from "@/src/domain/seals";
import { PROTOTYPE_DESIGN_VERSION } from "@/src/fixtures/prototype-catalogue";
import { STAMP_PALETTE_VERSION } from "@/src/domain/stamp-palette";

/**
 * The three overlays, audited together.
 *
 * WP5's requirement is that the enlarged shop stamp, the enlarged locality seal
 * and the enlarged country seal share surface, header, dismissal, fact
 * hierarchy, action placement and assistive-technology behaviour — and that they
 * still say only what their own kind of artefact records. Both halves are here,
 * because the whole risk of consolidating them is that the second half is lost.
 */
const COLLECTION: StampCollection = {
  id: "collection-itoya",
  shopId: "shop-itoya",
  shopSlug: "ginza-itoya-main-store",
  shopNameSnapshot: "Ginza Itoya Main Store",
  shopLocalNameSnapshot: "銀座 伊東屋 本店",
  shopLocalNameLangSnapshot: "ja",
  collectedOn: "2026-03-14",
  shopTimezone: "Asia/Tokyo",
  countryCode: "JP",
  countryLabel: "Japan",
  localityName: "Chūō, Tokyo",
  localitySlug: "chuo-tokyo",
  simulated: true,
  stamp: {
    id: "stamp-ginza-itoya-main-store",
    tier: "shop",
    motif: "storefront",
    ink: "navy",
    localityLabel: "Chūō, Tokyo",
    countryLabel: "Japan",
    designVersion: PROTOTYPE_DESIGN_VERSION,
    paletteVersion: STAMP_PALETTE_VERSION,
  },
};

const LOCALITY_SEAL: EarnedSeal = {
  id: "seal-locality-jp-chuo-tokyo",
  scope: "locality",
  countryCode: "JP",
  countryLabel: "Japan",
  localitySlug: "chuo-tokyo",
  localityName: "Chūō, Tokyo",
  earnedOn: "2026-03-14",
  derivedFromShopId: "shop-itoya",
  stamp: {
    id: "seal-locality-jp-chuo-tokyo",
    tier: "locality",
    motif: "arcade",
    ink: "teal",
    localityLabel: "Chūō, Tokyo",
    countryLabel: "Japan",
    designVersion: PROTOTYPE_DESIGN_VERSION,
    paletteVersion: STAMP_PALETTE_VERSION,
  },
};

const COUNTRY_SEAL: EarnedSeal = {
  id: "seal-country-sg",
  scope: "country",
  countryCode: "SG",
  countryLabel: "Singapore",
  earnedOn: "2026-06-03",
  derivedFromShopId: "shop-fook-hing",
  coverageSetVersion: "sg-2026-08",
  stamp: {
    id: "seal-country-sg",
    tier: "country",
    motif: "harbour",
    ink: "vermilion",
    localityLabel: "Singapore",
    countryLabel: "Singapore",
    designVersion: PROTOTYPE_DESIGN_VERSION,
    paletteVersion: STAMP_PALETTE_VERSION,
  },
};

const SUBJECTS = [
  { name: "shop stamp", subject: impressionSubject(COLLECTION), tier: "Shop stamp" },
  { name: "locality seal", subject: sealSubject(LOCALITY_SEAL), tier: "Locality seal" },
  { name: "country seal", subject: sealSubject(COUNTRY_SEAL), tier: "Country seal" },
] as const;

function open(subject: (typeof SUBJECTS)[number]["subject"]) {
  const onClose = vi.fn();

  render(
    <PassportDetailOverlay
      onClose={onClose}
      returnHref="/passport/jp/chuo-tokyo"
      subject={subject}
    />,
  );

  return { dialog: screen.getByRole("dialog"), onClose };
}

describe("one sheet for all three", () => {
  it.each(SUBJECTS)("$name is a modal dialog named by its heading", ({ subject }) => {
    const { dialog } = open(subject);

    expect(dialog).toHaveAttribute("aria-modal", "true");

    const labelledBy = dialog.getAttribute("aria-labelledby");
    expect(labelledBy).toBeTruthy();

    const heading = document.getElementById(labelledBy as string);
    expect(heading?.tagName).toBe("H2");
    expect(heading?.textContent).toBeTruthy();
  });

  it.each(SUBJECTS)("$name states its kind above the artwork", ({ subject, tier }) => {
    const { dialog } = open(subject);
    const overline = within(dialog).getByText(tier, { exact: true });

    // The tier reads before the impression, in every branch, so the header is
    // the same shape whichever artefact is open.
    expect(
      overline.compareDocumentPosition(
        within(dialog).getByRole("img") as unknown as Node,
      ) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it.each(SUBJECTS)("$name puts its dismissal in the same place", ({ subject }) => {
    const { dialog } = open(subject);
    const close = within(dialog).getByRole("button", { name: /^close/i });

    // First control in the sheet, so Tab reaches the way out before anything
    // else — and it is the first focusable element the focus trap cycles to.
    const focusable = [...dialog.querySelectorAll("a[href], button")];
    expect(focusable[0]).toBe(close);
  });

  it.each(SUBJECTS)("$name closes on Escape", ({ subject }) => {
    const { onClose } = open(subject);

    fireEvent.keyDown(document, { key: "Escape" });

    expect(onClose).toHaveBeenCalled();
  });

  it.each(SUBJECTS)("$name closes on its own control", ({ subject }) => {
    const { dialog, onClose } = open(subject);

    fireEvent.click(within(dialog).getByRole("button", { name: /^close/i }));

    expect(onClose).toHaveBeenCalled();
  });

  it.each(SUBJECTS)("$name closes on the backdrop", ({ subject }) => {
    const { onClose } = open(subject);
    const scrim = screen
      .getByTestId("passport-detail")
      .querySelector('button[aria-hidden="true"]');

    fireEvent.click(scrim as Element);

    expect(onClose).toHaveBeenCalled();
  });

  it.each(SUBJECTS)("$name shows the impression on the enlarged plate", ({ subject }) => {
    const { dialog } = open(subject);
    const plate = dialog.querySelector("[data-plate-size]");

    expect(plate).toHaveAttribute("data-plate-size", "detail");
    expect(plate).toHaveAttribute("data-plate-state", "collected");
  });

  it.each(SUBJECTS)("$name lists its facts as a description list", ({ subject }) => {
    const { dialog } = open(subject);
    const terms = [...dialog.querySelectorAll("dt")].map((node) => node.textContent);

    expect(terms).toContain("Country");
    expect(terms.length).toBeGreaterThan(1);
  });

  it.each(SUBJECTS)("$name gives its date a machine-readable time", ({ subject }) => {
    const { dialog } = open(subject);
    const time = dialog.querySelector("time");

    expect(time).toHaveAttribute("dateTime", expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/));
  });
});

describe("what each kind records", () => {
  it("a shop stamp reports a collection date and leads to its shop", () => {
    const { dialog } = open(impressionSubject(COLLECTION));

    expect(within(dialog).getByText("Collected", { exact: true })).toBeInTheDocument();
    // The sheet's own line, not the one pressed into the impression.
    const localName = dialog.querySelector("p[lang]");

    expect(localName).toHaveTextContent("銀座 伊東屋 本店");
    expect(localName).toHaveAttribute("lang", "ja");
    expect(localName).toHaveAttribute("dir", "auto");

    const link = within(dialog).getByRole("link", { name: /open shop/i });

    expect(link).toHaveAttribute(
      "href",
      `/shops/ginza-itoya-main-store?from=passport&back=${encodeURIComponent(
        "/passport/jp/chuo-tokyo?stamp=collection-itoya",
      )}`,
    );
  });

  it("a locality seal reports an earned date and leads nowhere", () => {
    const { dialog } = open(sealSubject(LOCALITY_SEAL));

    expect(within(dialog).getByText("Earned", { exact: true })).toBeInTheDocument();
    expect(within(dialog).queryByRole("link")).not.toBeInTheDocument();
    expect(within(dialog).queryByText("Collected")).not.toBeInTheDocument();
  });

  it("a country seal names no locality, because it has none", () => {
    const { dialog } = open(sealSubject(COUNTRY_SEAL));
    const terms = [...dialog.querySelectorAll("dt")].map((node) => node.textContent);

    expect(terms).toEqual(["Country", "Earned"]);
    expect(within(dialog).queryByRole("link")).not.toBeInTheDocument();
  });

  it("keeps the removed explanatory sentence out of both seal overlays", () => {
    for (const seal of [LOCALITY_SEAL, COUNTRY_SEAL]) {
      const { unmount } = render(
        <PassportDetailOverlay onClose={() => {}} subject={sealSubject(seal)} />,
      );

      expect(
        screen.queryByText(/derived from verified visits/i),
      ).not.toBeInTheDocument();
      expect(screen.queryByText(/not collected on its own/i)).not.toBeInTheDocument();

      unmount();
    }
  });

  it("invents nothing: no rating, no note, no sharing, no history", () => {
    for (const { subject } of SUBJECTS) {
      const { dialog } = open(subject);
      const text = dialog.textContent ?? "";

      for (const forbidden of ["Rating", "Note", "Share", "Visits", "Rank", "Rare"]) {
        expect(text).not.toContain(forbidden);
      }

      dialog.remove();
    }
  });

  it("renders nothing at all when there is no subject", () => {
    const { container } = render(
      <PassportDetailOverlay onClose={() => {}} subject={null} />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});
