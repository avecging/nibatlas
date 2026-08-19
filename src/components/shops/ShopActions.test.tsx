import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { ShopActions } from "@/src/components/shops/ShopActions";
import { CollectionProvider } from "@/src/features/collection/collection-store";
import { findDemoShop } from "@/src/fixtures/demo-catalogue";

const shop = findDemoShop("demo-nakano-pen-archive")!;

function renderActions() {
  render(
    <CollectionProvider>
      <ShopActions shop={shop} />
    </CollectionProvider>,
  );

  return screen.getByRole("button", { name: /collect stamp \(simulated\)/i });
}

function openPreflight() {
  const trigger = renderActions();

  // jsdom does not focus a button on click the way a browser does, so the
  // starting focus is set explicitly to match real pointer interaction.
  trigger.focus();
  fireEvent.click(trigger);

  return { trigger, dialog: screen.getByRole("dialog", { name: /before you collect/i }) };
}

describe("collection preflight dialog", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it("is a modal dialog that takes focus when it opens", () => {
    const { dialog } = openPreflight();

    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveFocus();
  });

  it("keeps Tab inside the dialog", () => {
    const { dialog } = openPreflight();
    const controls = within(dialog).getAllByRole("button");
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
    const first = within(dialog).getAllByRole("button")[0] as HTMLElement;

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
