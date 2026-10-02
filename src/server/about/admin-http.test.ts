import { describe, it, expect, vi } from "vitest";
import { handleAboutAdmin } from "./admin-http";
import { DEFAULT_ABOUT } from "@/src/features/about/default-content";
import { AdminForbiddenError } from "../admin/http";
import { ShopOperationError } from "../admin/shop-http";
const id = "e1000000-0000-4000-8000-000000000001";
const gateway = (role = "admin") => ({
  getIdentity: vi.fn().mockResolvedValue(id),
  getAccess: vi.fn().mockResolvedValue({ role }),
  listAudit: vi.fn(),
  call: vi.fn().mockResolvedValue(null),
});
const request = (body?: unknown, origin = "https://nibatlas.test") =>
  new Request(
    "https://nibatlas.test/api/v1/admin/about",
    body === undefined
      ? {}
      : {
          method: "POST",
          headers: { origin, "content-type": "application/json" },
          body: JSON.stringify(body),
        },
  );
describe("About admin boundary", () => {
  it.each(["editor", "user"])(
    "denies %s before content reads or writes",
    async (role) => {
      const g = gateway(role);
      expect((await handleAboutAdmin(request(), g)).status).toBe(403);
      expect(g.call).not.toHaveBeenCalled();
    },
  );
  it("denies signed-out and revoked admins and redacts provider errors", async () => {
    const g = gateway();
    g.getIdentity.mockResolvedValue(null);
    expect((await handleAboutAdmin(request(), g)).status).toBe(401);
    g.getIdentity.mockResolvedValue(id);
    g.call.mockRejectedValue(new AdminForbiddenError());
    expect((await handleAboutAdmin(request(), g)).status).toBe(403);
    g.call.mockRejectedValue(new Error("secret database details"));
    const r = await handleAboutAdmin(request(), g);
    expect(r.status).toBe(503);
    expect(await r.text()).not.toContain("secret");
  });
  it("returns initial copy only to admins and never caches it", async () => {
    const r = await handleAboutAdmin(request(), gateway());
    expect(r.headers.get("cache-control")).toBe("private, no-store");
    expect(r.headers.get("x-robots-tag")).toContain("noindex");
    expect((await r.json()).draft).toEqual(DEFAULT_ABOUT);
  });
  it("enforces same origin, bounded JSON and safe links", async () => {
    const g = gateway(),
      body = { action: "save", revision: null, document: DEFAULT_ABOUT };
    expect(
      (await handleAboutAdmin(request(body, "https://evil.test"), g)).status,
    ).toBe(403);
    expect(
      (
        await handleAboutAdmin(
          request({
            ...body,
            document: { ...DEFAULT_ABOUT, introduction: "a".repeat(140000) },
          }),
          g,
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await handleAboutAdmin(
          request({
            ...body,
            document: {
              ...DEFAULT_ABOUT,
              support: { ...DEFAULT_ABOUT.support, url: "javascript:alert(1)" },
            },
          }),
          g,
        )
      ).status,
    ).toBe(422);
    expect(g.call).not.toHaveBeenCalled();
  });
  it("saves only draft content and publishes only the exact saved revision", async () => {
    const g = gateway();
    g.call.mockResolvedValue({
      revision: id,
      publishedRevision: null,
      publishedAt: null,
      draft: DEFAULT_ABOUT,
      secret: "hidden",
    });
    const r = await handleAboutAdmin(
      request({ action: "save", revision: null, document: DEFAULT_ABOUT }),
      g,
    );
    expect(r.status).toBe(200);
    expect(await r.text()).not.toContain("hidden");
    expect(g.call).toHaveBeenLastCalledWith("admin_about_page", {
      p_action: "save",
      p_revision: null,
      p_document: expect.any(Object),
    });
    await handleAboutAdmin(request({ action: "publish", revision: id }), g);
    expect(g.call).toHaveBeenLastCalledWith("admin_about_page", {
      p_action: "publish",
      p_revision: id,
    });
    expect(
      (
        await handleAboutAdmin(
          request({ action: "publish", revision: id, document: DEFAULT_ABOUT }),
          g,
        )
      ).status,
    ).toBe(400);
    g.call.mockRejectedValue(new ShopOperationError("40001"));
    expect(
      (await handleAboutAdmin(request({ action: "publish", revision: id }), g))
        .status,
    ).toBe(409);
  });
});
