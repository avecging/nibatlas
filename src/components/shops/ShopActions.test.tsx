import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { ShopActions } from "@/src/components/shops/ShopActions";
import { CatalogueProvider } from "@/src/features/catalogue/CatalogueProvider";
import { CollectionProvider } from "@/src/features/collection/collection-store";
import { findPrototypeShop } from "@/src/fixtures/prototype-catalogue";
import {
  clearReviewerMode,
  seedReviewerMode,
  WithReviewerMode,
} from "@/src/test/reviewer";

const shop = findPrototypeShop("juspirit-banqiao")!;

/**
 * Mirrors the focus-trap's own selector. The dialog now contains an inline
 * Privacy link as well as buttons, so the trap's first stop is not the first
 * button — asserting against buttons alone would test the old markup.
 */
const FOCUSABLE = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

function focusablesIn(dialog: HTMLElement): readonly HTMLElement[] {
  return [...dialog.querySelectorAll<HTMLElement>(FOCUSABLE)];
}

/** Reviewer mode keeps the "(simulated)" suffix; normal mode drops it. */
const COLLECT_LABEL = {
  normal: /^collect stamp$/i,
  reviewer: /collect stamp \(simulated\)/i,
} as const;

function renderActions(mode: "normal" | "reviewer" = "reviewer") {
  seedReviewerMode(mode === "reviewer");

  render(
    <WithReviewerMode>
      <CollectionProvider>
        <ShopActions shop={shop} />
      </CollectionProvider>
    </WithReviewerMode>,
  );

  return screen.getByRole("button", { name: COLLECT_LABEL[mode] });
}

function openPreflight(mode: "normal" | "reviewer" = "reviewer") {
  const trigger = renderActions(mode);

  // jsdom does not focus a button on click the way a browser does, so the
  // starting focus is set explicitly to match real pointer interaction.
  trigger.focus();
  fireEvent.click(trigger);

  return { trigger, dialog: screen.getByRole("dialog", { name: /before you collect/i }) };
}

describe("collection preflight dialog", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    clearReviewerMode();
  });

  it("is a modal dialog that takes focus when it opens", () => {
    const { dialog } = openPreflight();

    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveFocus();
  });

  it("keeps Tab inside the dialog", () => {
    const { dialog } = openPreflight();
    const controls = focusablesIn(dialog);
    const first = controls[0] as HTMLElement;
    const last = controls[controls.length - 1] as HTMLElement;

    expect(controls.length).toBeGreaterThan(1);

    // Forward from the dialog container enters at the first control.
    fireEvent.keyDown(document, { key: "Tab" });
    expect(first).toHaveFocus();

    // Forward from the last control wraps back to the first.
    last.focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(first).toHaveFocus();

    // Backward from the first control wraps to the last.
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(last).toHaveFocus();
  });

  it("pulls focus back if it has escaped the dialog", () => {
    const { trigger, dialog } = openPreflight();
    const first = focusablesIn(dialog)[0] as HTMLElement;

    trigger.focus();
    expect(trigger).toHaveFocus();

    fireEvent.keyDown(document, { key: "Tab" });
    expect(first).toHaveFocus();
  });

  it("closes on Escape and restores focus to the control that opened it", () => {
    const { trigger } = openPreflight();

    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByRole("dialog", { name: /before you collect/i })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("restores focus when cancelled with the pointer", () => {
    const { trigger, dialog } = openPreflight();

    fireEvent.click(within(dialog).getByRole("button", { name: /cancel/i }));

    expect(screen.queryByRole("dialog", { name: /before you collect/i })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("hands focus to the ceremony and back to the shop when it closes", () => {
    const { trigger, dialog } = openPreflight();

    fireEvent.click(within(dialog).getByRole("button", { name: /simulate: i am at this shop/i }));

    const ceremony = screen.getByRole("dialog", { name: /impression collected/i });
    expect(ceremony).toHaveFocus();

    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByRole("dialog", { name: /impression collected/i })).not.toBeInTheDocument();
    // The trigger has become "View Atlas Stamp" now that an impression exists.
    expect(trigger).toHaveFocus();
  });
});

/**
 * WP1 acceptance: the collection journey works in both modes, and normal-mode
 * copy is brief, honest, and never claims a location check that did not happen.
 */
describe("collection copy outside reviewer mode", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    clearReviewerMode();
  });

  it("labels the action as the product action, with no simulation suffix", () => {
    const trigger = renderActions("normal");

    expect(trigger).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /simulated/i }),
    ).not.toBeInTheDocument();
  });

  it("states plainly that the location check is not running, without narrating the build", () => {
    const { dialog } = openPreflight("normal");
    const body = dialog.textContent ?? "";

    // Honest: the reader is told the check has not happened.
    expect(body).toMatch(/not running yet/i);
    expect(body).toMatch(/not a verified visit/i);

    // Brief: no milestone numbers, no simulation vocabulary, no essay.
    expect(body).not.toMatch(/milestone/i);
    expect(body).not.toMatch(/simulat/i);
    expect(body).not.toMatch(/prototype/i);
    expect(within(dialog).queryByTestId("reviewer-note")).not.toBeInTheDocument();

    // The fuller explanation is linked rather than reproduced.
    expect(within(dialog).getByRole("link", { name: /how location is used/i })).toHaveAttribute(
      "href",
      "/privacy",
    );
  });

  it("still collects an impression and opens the ceremony", () => {
    const { dialog } = openPreflight("normal");

    fireEvent.click(within(dialog).getByRole("button", { name: /^i am at this shop$/i }));

    const ceremony = screen.getByRole("dialog", { name: /impression collected/i });

    expect(ceremony).toBeInTheDocument();
    expect(ceremony.textContent).not.toMatch(/simulat/i);
    expect(ceremony.textContent).toMatch(/your location was not checked/i);
  });

  it("keeps the diagnostic wording available to reviewers", () => {
    const { dialog } = openPreflight("reviewer");

    expect(dialog.textContent).toMatch(/never calls the Geolocation API/i);
    expect(
      within(dialog).getByRole("button", { name: /simulate: i am at this shop/i }),
    ).toBeInTheDocument();
  });
});

/**
 * A stamp that is already in the Passport opens straight onto its impression.
 *
 * The button says *View Atlas Stamp*, so what follows it has to be the stamp.
 * The confirmation that used to sit in between asked the reader to agree to a
 * collection they had already made, and its confirm button ran a collection the
 * store declined — a dialog and a write that both existed to do nothing.
 */
describe("viewing an impression that is already collected", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    clearReviewerMode();
  });

  /** Collects once through the real journey, then dismisses the ceremony. */
  function collectThenClose(mode: "normal" | "reviewer" = "normal") {
    const { trigger, dialog } = openPreflight(mode);

    fireEvent.click(
      within(dialog).getByRole("button", {
        name: mode === "reviewer" ? /simulate: i am at this shop/i : /^i am at this shop$/i,
      }),
    );

    const impressionFacts = within(
      screen.getByRole("dialog", { name: /impression collected/i }),
    ).getByRole("status").textContent;

    fireEvent.click(screen.getByRole("button", { name: /back to shop/i }));
    trigger.focus();

    return { trigger, impressionFacts };
  }

  it("opens the impression in one tap, with no confirmation in between", () => {
    const { trigger } = collectThenClose();

    expect(trigger).toHaveAccessibleName(/view atlas stamp/i);

    fireEvent.click(trigger);

    expect(
      screen.getByRole("dialog", { name: /already in your passport/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("dialog", { name: /before you collect/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /show the impression/i }),
    ).not.toBeInTheDocument();
  });

  it("issues no second stamp and does not move the collection date", () => {
    const { trigger, impressionFacts } = collectThenClose();
    const collectedLine = screen.getByText(/this impression is in your passport/i)
      .textContent;

    fireEvent.click(trigger);

    const sheet = screen.getByRole("dialog", { name: /already in your passport/i });

    // The same impression, reporting the same place, date and timezone. Only the
    // title differs, because this sheet is not announcing a collection.
    expect(within(sheet).getByRole("status").textContent).toEqual(impressionFacts);
    fireEvent.click(within(sheet).getByRole("button", { name: /back to shop/i }));
    expect(
      screen.getByText(/this impression is in your passport/i).textContent,
    ).toEqual(collectedLine);

    // And exactly one impression, not two.
    expect(screen.getAllByText(/this impression is in your passport/i)).toHaveLength(1);
  });

  it("never replays the press for an impression it did not just take", () => {
    const { trigger } = collectThenClose();

    fireEvent.click(trigger);

    expect(screen.getByTestId("stamp-ceremony").querySelector('[data-phase]')).toHaveAttribute(
      "data-phase",
      "settled",
    );
  });

  it("takes focus and hands it back to the control that opened it", () => {
    const { trigger } = collectThenClose();

    fireEvent.click(trigger);

    const sheet = screen.getByRole("dialog", { name: /already in your passport/i });
    expect(sheet).toHaveFocus();

    fireEvent.keyDown(document, { key: "Escape" });

    expect(
      screen.queryByRole("dialog", { name: /already in your passport/i }),
    ).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("leaves first-time collection untouched", () => {
    const { dialog } = openPreflight("normal");

    // The preflight is now only ever the pre-collection dialog.
    expect(dialog).toHaveAccessibleName(/before you collect/i);
    expect(dialog.textContent).toMatch(/not running yet/i);
    expect(
      within(dialog).getByRole("button", { name: /^i am at this shop$/i }),
    ).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("button", { name: /^i am at this shop$/i }));

    expect(
      screen.getByRole("dialog", { name: /impression collected/i }),
    ).toBeInTheDocument();
  });
});

/*
 * Mode separation, on the one surface where getting it wrong would matter most.
 *
 * Issue #25: the simulated collection is fixture/reviewer-only. Beside real
 * catalogue records a simulated impression would read as a visit that had been
 * verified, and real issuance is Milestone 5.
 */
describe("simulated collection across catalogue modes", () => {
  beforeEach(() => {
    window.localStorage.clear();
    clearReviewerMode();
  });

  function renderInMode(mode: string) {
    seedReviewerMode(true);

    render(
      <WithReviewerMode>
        <CatalogueProvider mode={mode}>
          <CollectionProvider>
            <ShopActions shop={shop} />
          </CollectionProvider>
        </CatalogueProvider>
      </WithReviewerMode>,
    );
  }

  it("offers the simulated flow in fixture mode", () => {
    renderInMode("fixture");

    expect(
      screen.getByRole("button", { name: COLLECT_LABEL.reviewer }),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("collection-pending")).not.toBeInTheDocument();
  });

  it("withholds it in api mode and says why, without offering a stamp", () => {
    renderInMode("api");

    expect(screen.queryByRole("button", { name: /collect stamp/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /view atlas stamp/i })).not.toBeInTheDocument();
    expect(screen.getByTestId("collection-pending")).toHaveTextContent(
      /not being issued yet/i,
    );
    // Directions do not depend on the mode and stay.
    expect(screen.getByRole("link", { name: /directions/i })).toBeInTheDocument();
  });
});
