import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { StampCeremony } from "@/src/components/stamps/StampCeremony";
import { toStampCollection } from "@/src/fixtures/demo-passport";
import { findDemoShop } from "@/src/fixtures/demo-catalogue";

const shop = findDemoShop("demo-ginza-fountain-pen-salon")!;
const collection = toStampCollection(shop, "2026-06-12");

function setReducedMotion(reduced: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: reduced && query.includes("prefers-reduced-motion"),
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

describe("StampCeremony", () => {
  it("presents the impression in a focused modal dialog", () => {
    setReducedMotion(false);
    render(
      <StampCeremony
        collection={collection}
        alreadyCollected={false}
        passportHref="/passport/jp/chuo-tokyo"
        onClose={vi.fn()}
      />,
    );

    const dialog = screen.getByRole("dialog", { name: /impression collected/i });

    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveFocus();
  });

  it("shows shop, place, and local collection date", () => {
    setReducedMotion(false);
    render(
      <StampCeremony
        collection={collection}
        alreadyCollected={false}
        passportHref="/passport/jp/chuo-tokyo"
        onClose={vi.fn()}
      />,
    );

    expect(
      screen.getByText(/Demo Ginza Fountain Pen Salon · Chūō, Tokyo, Japan · 2026-06-12/),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /open in passport/i })).toHaveAttribute(
      "href",
      "/passport/jp/chuo-tokyo",
    );
  });

  it("skips the press animation when reduced motion is requested", () => {
    setReducedMotion(true);
    const { container } = render(
      <StampCeremony
        collection={collection}
        alreadyCollected={false}
        passportHref="/passport/jp/chuo-tokyo"
        onClose={vi.fn()}
      />,
    );

    const dialog = container.querySelector('[role="dialog"]');

    expect(dialog?.className).toMatch(/settled/);
    expect(dialog?.className).not.toMatch(/pressing/);
  });

  it("names a duplicate collection instead of pretending it is new", () => {
    setReducedMotion(false);
    render(
      <StampCeremony
        collection={collection}
        alreadyCollected
        passportHref="/passport/jp/chuo-tokyo"
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByRole("dialog", { name: /already in your passport/i })).toBeInTheDocument();
  });

  it("closes on Escape", () => {
    setReducedMotion(false);
    const onClose = vi.fn();

    render(
      <StampCeremony
        collection={collection}
        alreadyCollected={false}
        passportHref="/passport/jp/chuo-tokyo"
        onClose={onClose}
      />,
    );

    fireEvent.keyDown(document, { key: "Escape" });

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
