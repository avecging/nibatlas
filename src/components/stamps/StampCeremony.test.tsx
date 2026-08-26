import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { StampCeremony } from "@/src/components/stamps/StampCeremony";
import { toStampCollection } from "@/src/fixtures/prototype-passport";
import { findPrototypeShop } from "@/src/fixtures/prototype-catalogue";

const shop = findPrototypeShop("ginza-itoya-main-store")!;
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
      screen.getByText(/Ginza Itoya Main Store · Chūō, Tokyo, Japan · 2026-06-12/),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /open in passport/i })).toHaveAttribute(
      "href",
      "/passport/jp/chuo-tokyo",
    );
  });

  it("shows the completed impression instead of pressing it under reduced motion", () => {
    setReducedMotion(true);
    const { container } = render(
      <StampCeremony
        collection={collection}
        alreadyCollected={false}
        passportHref="/passport/jp/chuo-tokyo"
        onClose={vi.fn()}
      />,
    );

    const plate = container.querySelector("[data-phase]");

    expect(plate).toHaveAttribute("data-reduced", "true");
    // Settled from the first frame: there is no press to skip past.
    expect(plate).toHaveAttribute("data-phase", "settled");
  });

  it("presses the impression when motion is allowed", () => {
    setReducedMotion(false);
    const { container } = render(
      <StampCeremony
        collection={collection}
        alreadyCollected={false}
        passportHref="/passport/jp/chuo-tokyo"
        onClose={vi.fn()}
      />,
    );

    const plate = container.querySelector("[data-phase]");

    expect(plate).toHaveAttribute("data-reduced", "false");
    expect(plate).toHaveAttribute("data-phase", "pressing");
  });

  it("never presses an impression that was already collected", () => {
    setReducedMotion(false);
    const { container } = render(
      <StampCeremony
        collection={collection}
        alreadyCollected
        passportHref="/passport/jp/chuo-tokyo"
        onClose={vi.fn()}
      />,
    );

    expect(container.querySelector("[data-phase]")).toHaveAttribute(
      "data-phase",
      "settled",
    );
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
