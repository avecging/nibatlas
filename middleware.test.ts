import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({ createClient: vi.fn(), identity: vi.fn(), role: vi.fn() }));
vi.mock("@/src/server/supabase/server-client", () => ({ createSupabaseClientForCookies: mocks.createClient }));

import { middleware } from "./middleware";

function request(path: string) {
  return new NextRequest(`https://nibatlas.test${path}`, { headers: { cookie: "session=old" } });
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.createClient.mockImplementation((store: { set(name: string, value: string, options?: object): void }) => ({
    auth: { getClaims: async () => {
      const id = await mocks.identity();
      if (id) store.set("session", "refreshed", { path: "/", httpOnly: true });
      return { data: id ? { claims: { sub: id, user_metadata: { role: "admin" } } } : null, error: null };
    } },
    rpc: async (name: string) => {
      expect(name).toBe("admin_access");
      return { data: { role: await mocks.role() }, error: null };
    },
  }));
});

const userId = "10000000-0000-4000-8000-000000000001";
describe("admin page request gate", () => {
  it("redirects signed-out visitors before any role lookup", async () => {
    mocks.identity.mockResolvedValue(null);
    const response = await middleware(request("/admin/shops"));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://nibatlas.test/me");
    expect(mocks.role).not.toHaveBeenCalled();
  });

  it("ignores editable metadata and redirects an ordinary account", async () => {
    mocks.identity.mockResolvedValue(userId);
    mocks.role.mockResolvedValue("user");
    const response = await middleware(request("/admin/shops"));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://nibatlas.test/me");
    expect(response.cookies.get("session")?.value).toBe("refreshed");
  });

  it("keeps editor catalogue access but redirects from admin-only pages", async () => {
    mocks.identity.mockResolvedValue(userId);
    mocks.role.mockResolvedValue("editor");
    expect((await middleware(request("/admin/shops"))).status).toBe(200);
    for (const path of ["/admin/about", "/admin/shops/import"]) {
      expect((await middleware(request(path))).status).toBe(307);
    }
  });

  it("preserves refreshed admin cookies for the page and next API request", async () => {
    mocks.identity.mockResolvedValue(userId);
    mocks.role.mockResolvedValue("admin");
    const incoming = request("/admin/about");
    const response = await middleware(incoming);
    expect(response.status).toBe(200);
    expect(response.cookies.get("session")?.value).toBe("refreshed");
    expect(incoming.cookies.get("session")?.value).toBe("refreshed");
    expect(mocks.role).toHaveBeenCalledOnce();
  });

  it("preserves rotated cookies even when the role lookup fails", async () => {
    mocks.identity.mockResolvedValue(userId);
    mocks.role.mockRejectedValue(Error("provider unavailable"));
    const response = await middleware(request("/admin/shops"));
    expect(response.status).toBe(503);
    expect(response.cookies.get("session")?.value).toBe("refreshed");
    expect(await response.text()).not.toContain("provider unavailable");
  });
});
