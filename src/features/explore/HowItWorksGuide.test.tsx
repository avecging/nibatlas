import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { HowItWorksGuide } from "./HowItWorksGuide";

function motion(reduced: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: reduced && query.includes("prefers-reduced-motion"),
    media: query, onchange: null, addEventListener: () => {},
    removeEventListener: () => {}, dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

describe("HowItWorksGuide", () => {
  it("navigates five slides, shows generated seals, and closes without collecting", () => {
    motion(false);
    const onClose = vi.fn();
    const { container } = render(<HowItWorksGuide onClose={onClose} />);
    const dialog = screen.getByRole("dialog", { name: "Welcome to Nib Atlas" });
    expect(dialog).toHaveFocus();
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(screen.getByLabelText("Slide 1 of 5")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(dialog).toHaveAttribute("data-guide-slide", "2");
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(container.querySelector('[data-phase="pressing"]')).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(container.querySelectorAll("[data-shop-seal-shape]")).toHaveLength(3);
    expect(container.querySelectorAll('[data-seal-template="cartouche-v2"]')).toHaveLength(2);
    expect([...container.querySelectorAll("[data-guide-seal-order]")].map((seal) => seal.getAttribute("data-guide-seal-order"))).toEqual(["1", "2", "3", "4", "5"]);
    expect([...container.querySelectorAll("[data-guide-seal-order]")].map((seal) => (seal as HTMLElement).style.getPropertyValue("--press-delay"))).toEqual(["0ms", "578ms", "1156ms", "1734ms", "2312ms"]);
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByRole("heading", { name: "Your passport" })).toBeInTheDocument();
    expect(container.querySelector("[data-passport-cover]")).toHaveTextContent("Nib Atlas");
    expect(container.querySelector("[data-passport-cover]")).toHaveTextContent("Passport");
    expect(container.querySelector("[data-passport-cover]")).toHaveTextContent("Volume I");
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("supports Back, swipe, Escape, and reduced motion", () => {
    motion(true);
    const onClose = vi.fn();
    const { container } = render(<HowItWorksGuide onClose={onClose} />);
    const body = container.querySelector('[class*="body"]')!;
    fireEvent.touchStart(body, { touches: [{ clientX: 250, clientY: 80 }] });
    fireEvent.touchEnd(body, { changedTouches: [{ clientX: 100, clientY: 85 }] });
    expect(screen.getByRole("heading", { name: "Discover shops" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByRole("heading", { name: "Welcome to Nib Atlas" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /go to slide 3/i }));
    expect(container.querySelector("[data-phase]")).toHaveAttribute("data-reduced", "true");
    expect(container.querySelector("[data-phase]")).toHaveAttribute("data-phase", "settled");
    fireEvent.click(screen.getByRole("button", { name: /go to slide 4/i }));
    expect(container.querySelectorAll('[data-guide-seal-order][data-reduced="true"]')).toHaveLength(5);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledOnce();
  });
});
