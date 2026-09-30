import { describe, expect, it } from "vitest";
import { normalizeChannelValue, contactCopyLabel, parseChannelLinkType } from "./shop-channels";

describe("shop social and contact values", () => {
  it("turns supported social handles into platform profile URLs", () => {
    expect(normalizeChannelValue("social", "instagram", "@pen-shop")).toEqual({
      value: "@pen-shop", url: "https://www.instagram.com/pen-shop/",
    });
    expect(normalizeChannelValue("social", "x", "https://twitter.com/pen-shop").url).toBe("https://twitter.com/pen-shop");
    expect(normalizeChannelValue("social", "youtube", "@pen-shop").url).toBe("https://www.youtube.com/@pen-shop");
    expect(() => normalizeChannelValue("social", "youtube", "pen-shop")).toThrow(/beginning with @/);
  });

  it("builds mobile destinations only from supported, explicit identifiers", () => {
    expect(normalizeChannelValue("contact", "whatsapp", "+65 9123 4567")).toEqual({
      value: "+65 9123 4567", url: "https://wa.me/6591234567",
    });
    expect(normalizeChannelValue("contact", "whatsapp", "9123 4567").url).toBeNull();
    expect(normalizeChannelValue("contact", "telegram", "@pen_shop").url).toBe("https://t.me/pen_shop");
    expect(normalizeChannelValue("contact", "wechat", "store-id")).toEqual({ value: "store-id", url: null });
  });

  it("copies a share URL when it does not expose a usable account ID", () => {
    const share = "https://t.me/+inviteToken";
    expect(normalizeChannelValue("contact", "telegram", share)).toEqual({ value: share, url: null });
    expect(contactCopyLabel(share)).toBe("Link copied");
    expect(parseChannelLinkType("contact_wechat")).toEqual({ kind: "contact", platform: "wechat" });
  });
});
