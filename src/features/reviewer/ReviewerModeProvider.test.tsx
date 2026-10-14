import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { REVIEWER_STORAGE_KEY } from "@/src/features/reviewer/reviewer-mode";
import { ReviewerModeBadge } from "@/src/features/reviewer/ReviewerModeBadge";
import {
  ReviewerModeProvider,
  useReviewerMode,
} from "@/src/features/reviewer/ReviewerModeProvider";

function Probe() {
  const reviewer = useReviewerMode();

  return <p data-testid="probe">{reviewer ? "on" : "off"}</p>;
}

function renderAt(url: string) {
  window.history.replaceState({}, "", url);

  return render(
    <ReviewerModeProvider>
      <Probe />
      <ReviewerModeBadge />
    </ReviewerModeProvider>,
  );
}

const mode = () => screen.getByTestId("probe").textContent;
const stored = () => window.localStorage.getItem(REVIEWER_STORAGE_KEY);

describe("ReviewerModeProvider", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    window.history.replaceState({}, "", "/");
  });

  it("is off on a device that has never chosen", () => {
    renderAt("/");

    expect(mode()).toBe("off");
    expect(stored()).toBeNull();
  });

  it("enables and remembers the choice on ?review=1", () => {
    renderAt("/?review=1");

    expect(mode()).toBe("on");
    expect(stored()).toBe("1");
  });

  it("disables and remembers the choice on ?review=0", () => {
    window.localStorage.setItem(REVIEWER_STORAGE_KEY, "1");
    renderAt("/?review=0");

    expect(mode()).toBe("off");
    expect(stored()).toBe("0");
  });

  it("uses the remembered choice when no parameter is present", () => {
    window.localStorage.setItem(REVIEWER_STORAGE_KEY, "1");
    renderAt("/passport");

    expect(mode()).toBe("on");
  });

  it("renders no reviewer marker or exit control in normal mode", () => {
    renderAt("/");

    expect(screen.queryByTestId("reviewer-mode-badge")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /reviewer mode/i })).not.toBeInTheDocument();
  });

  it("offers a discreet way out that persists the choice", () => {
    renderAt("/?review=1");

    fireEvent.click(screen.getByRole("button", { name: /exit reviewer mode/i }));

    expect(mode()).toBe("off");
    expect(stored()).toBe("0");
    expect(screen.queryByTestId("reviewer-mode-badge")).not.toBeInTheDocument();
  });

  it("takes review out of the address bar on exit, so a reload stays out", () => {
    // Remembering the choice is not enough: the parameter outranks it, so
    // reloading the page the reviewer exited from would put them straight back.
    renderAt("/me?destination=ginza&review=1");
    expect(mode()).toBe("on");

    fireEvent.click(screen.getByRole("button", { name: /exit reviewer mode/i }));

    expect(window.location.search).not.toContain("review");
    expect(window.location.search).toContain("destination=ginza");

    // Re-mounting at the URL the browser now holds is the reload.
    cleanup();
    renderAt(`${window.location.pathname}${window.location.search}`);
    expect(mode()).toBe("off");
  });

  it("leaves an unrelated URL alone when exiting without the parameter", () => {
    window.localStorage.setItem(REVIEWER_STORAGE_KEY, "1");
    renderAt("/about?destination=kobe");
    expect(mode()).toBe("on");

    fireEvent.click(screen.getByRole("button", { name: /exit reviewer mode/i }));

    expect(mode()).toBe("off");
    expect(window.location.pathname).toBe("/about");
    expect(window.location.search).toBe("?destination=kobe");
  });

  it("survives storage being unavailable", () => {
    const descriptor = Object.getOwnPropertyDescriptor(window, "localStorage");

    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get() {
        throw new Error("blocked");
      },
    });

    try {
      // A device that cannot remember a choice is a device that has not made
      // one: the product, not a crash.
      renderAt("/");
      expect(mode()).toBe("off");
    } finally {
      if (descriptor) {
        Object.defineProperty(window, "localStorage", descriptor);
      }
    }
  });
});
