import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MessagingActions } from "./MessagingActions";

describe("public messaging actions", () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it("copies on desktop and shows a short confirmation", async () => {
    vi.stubGlobal("navigator", { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
    vi.stubGlobal("window", { matchMedia: () => ({ matches: false }), location: { assign: vi.fn() } });
    render(<MessagingActions channels={[{ platform: "wechat", value: "shop-id" }]} />);
    fireEvent.click(screen.getByRole("button", { name: "Contact shop on WeChat" }));
    expect(await screen.findByText("Copied · WeChat")).toBeInTheDocument();
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("shop-id");
  });

  it("uses an explicit supported destination on mobile", () => {
    const assign = vi.fn();
    vi.stubGlobal("window", { matchMedia: () => ({ matches: true }), location: { assign } });
    render(<MessagingActions channels={[{ platform: "telegram", value: "@pen_shop", url: "https://t.me/pen_shop" }]} />);
    fireEvent.click(screen.getByRole("button", { name: "Contact shop on Telegram" }));
    expect(assign).toHaveBeenCalledWith("https://t.me/pen_shop");
  });
});
