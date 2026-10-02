import { afterEach, describe, expect, it, vi } from "vitest";
import { readPublishedAbout } from "./read";
import { DEFAULT_ABOUT } from "@/src/features/about/default-content";
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
const setup = () => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "public-key");
};
describe("published About read", () => {
  it("reads only the public RPC, never draft or account state", async () => {
    setup();
    const fetch = vi
      .fn()
      .mockResolvedValue(
        Response.json({ ...DEFAULT_ABOUT, title: "Published title" }),
      );
    vi.stubGlobal("fetch", fetch);
    expect((await readPublishedAbout()).title).toBe("Published title");
    expect(fetch).toHaveBeenCalledWith(
      "https://example.supabase.co/rest/v1/rpc/read_published_about",
      expect.objectContaining({ cache: "no-store", body: "{}" }),
    );
  });
  it("uses baseline only when no replacement has ever been published", async () => {
    setup();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(null)));
    expect(await readPublishedAbout()).toEqual(DEFAULT_ABOUT);
  });
  it("does not silently replace published content on an outage or invalid response", async () => {
    setup();
    const fetch = vi
      .fn()
      .mockResolvedValue(Response.json({ draft: DEFAULT_ABOUT }));
    vi.stubGlobal("fetch", fetch);
    await expect(readPublishedAbout()).rejects.toThrow();
    fetch.mockResolvedValue(new Response("provider secrets", { status: 503 }));
    await expect(readPublishedAbout()).rejects.toThrow("About unavailable");
  });
});
