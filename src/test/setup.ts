import "@testing-library/jest-dom/vitest";

import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

// Vitest does not expose globals, so Testing Library's automatic cleanup is
// registered explicitly here.
//
// Browser storage is cleared with it. Reviewer mode and the collection store now
// both persist to `localStorage`, so without this one test's saves and
// impressions become the next test's starting state — which is the exact defect
// the mode-scoped stores exist to prevent.
afterEach(() => {
  cleanup();

  try {
    window.localStorage.clear();
    window.sessionStorage.clear();
  } catch {
    // Storage may be unavailable in a given environment; nothing to clear.
  }
});

// jsdom implements neither of these, and both are used by map, sheet, and
// ceremony components.
if (typeof window !== "undefined") {
  if (!window.matchMedia) {
    window.matchMedia = ((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;
  }

  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = vi.fn();
  }

  // The Passport book measures its field to size the object. jsdom has no
  // layout, so the observer never fires anything useful — it only has to exist.
  if (typeof window.ResizeObserver === "undefined") {
    class NoopResizeObserver implements ResizeObserver {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    }

    window.ResizeObserver = NoopResizeObserver;
  }
}
