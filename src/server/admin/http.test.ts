import { describe, expect, it, vi } from "vitest";
import {
  AdminForbiddenError,
  handleAdminRead,
  type AdminGateway,
} from "./http";
const id = "10000000-0000-4000-8000-000000000001";
const request = (path = "access", init?: RequestInit) =>
  new Request(`https://nibatlas.test/api/v1/admin/${path}`, init);
function gateway(role = "admin"): AdminGateway {
  return {
    getIdentity: vi.fn().mockResolvedValue(id),
    getAccess: vi.fn().mockResolvedValue({ role }),
    listAudit: vi.fn().mockResolvedValue([]),
  };
}
describe("admin direct request authorization", () => {
  it("refuses anonymous requests before privileged calls", async () => {
    const g = gateway();
    vi.mocked(g.getIdentity).mockResolvedValue(null);
    const r = await handleAdminRead(request(), "access", g);
    expect(r.status).toBe(401);
    expect(g.getAccess).not.toHaveBeenCalled();
    expect(r.headers.get("cache-control")).toBe("private, no-store");
  });
  it.each(["user", "owner", "", "ADMIN"])(
    "refuses unsupported role %s",
    async (role) => {
      const g = gateway(role);
      expect((await handleAdminRead(request("audit"), "audit", g)).status).toBe(
        403,
      );
      expect(g.listAudit).not.toHaveBeenCalled();
    },
  );
  it("allows editor access but reserves audit for admin", async () => {
    const g = gateway("editor");
    expect((await handleAdminRead(request(), "access", g)).status).toBe(200);
    expect((await handleAdminRead(request("audit"), "audit", g)).status).toBe(
      403,
    );
    expect(g.listAudit).not.toHaveBeenCalled();
  });
  it("rechecks roles on each request, ignoring a spoofed identity header", async () => {
    const g = gateway();
    expect((await handleAdminRead(request(), "access", g)).status).toBe(200);
    vi.mocked(g.getAccess).mockResolvedValue({ role: "user" });
    expect(
      (
        await handleAdminRead(
          request("access", {
            headers: { "x-role": "admin", "x-user-id": id },
          }),
          "access",
          g,
        )
      ).status,
    ).toBe(403);
    expect(g.getAccess).toHaveBeenCalledTimes(2);
  });
  it.each([
    "audit?after=bad",
    "audit?after=" + id + "&after=" + id,
    "audit?userId=" + id,
    "access?role=admin",
  ])("refuses injected parameters: %s", async (path) => {
    const g = gateway();
    expect(
      (
        await handleAdminRead(
          request(path),
          path.startsWith("audit") ? "audit" : "access",
          g,
        )
      ).status,
    ).toBe(400);
    expect(g.listAudit).not.toHaveBeenCalled();
  });
  it.each(["POST", "PUT", "DELETE"])(
    "does not turn the read boundary into a %s operation",
    async (method) => {
      const g = gateway();
      expect(
        (await handleAdminRead(request("audit", { method }), "audit", g))
          .status,
      ).toBe(400);
      expect(g.getIdentity).not.toHaveBeenCalled();
    },
  );
  it("redacts provider errors and handles database revocation between guard and read", async () => {
    const g = gateway();
    vi.mocked(g.listAudit).mockRejectedValue(new AdminForbiddenError());
    expect((await handleAdminRead(request("audit"), "audit", g)).status).toBe(
      403,
    );
    vi.mocked(g.listAudit).mockRejectedValue(
      new Error("secret SQL with coordinates"),
    );
    const response = await handleAdminRead(request("audit"), "audit", g);
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("SQL");
  });
  it("explicitly projects allowlisted nested audit data and bounds pagination", async () => {
    const g = gateway();
    vi.mocked(g.listAudit).mockResolvedValue(
      Array.from({ length: 101 }, () => ({
        id,
        actorUserId: null,
        actorKind: "database_operator",
        entityId: id,
        action: "profile_role_changed",
        entityType: "profile",
        requestId: id,
        before: { role: "user", hidden: "private" },
        after: { role: "admin", hidden: "private" },
        createdAt: "2026-09-12T00:00:00Z",
        hidden: "private",
      })),
    );
    const r = await handleAdminRead(request("audit?after=" + id), "audit", g);
    const body = await r.json();
    expect(body.entries).toHaveLength(100);
    expect(body.nextCursor).toBe(id);
    expect(JSON.stringify(body)).not.toContain("private");
    expect(g.listAudit).toHaveBeenCalledWith(id);
    expect(r.headers.get("vary")).toBe("Cookie");
  });
});

it.each(["shops", "stamps", "stamp_artwork_versions"])("projects %s audit summaries without private values", async (entityType) => {
  const g = gateway();
  vi.mocked(g.listAudit).mockResolvedValue([
    {
      id,
      actorUserId: id,
      actorKind: "account",
      entityId: id,
      action: "catalogue_update",
      entityType,
      requestId: id,
      before: {
        fingerprint: "a".repeat(32),
        publicationStatus: "published",
        note: "PRIVATE",
      },
      after: {
        fingerprint: "b".repeat(32),
        publicationStatus: "archived",
        rawBody: "PRIVATE",
      },
      createdAt: "2026-09-12T00:00:00Z",
    },
  ]);
  const r = await handleAdminRead(request("audit"), "audit", g);
  expect(r.status).toBe(200);
  const value = await r.json();
  expect(value.entries[0].after).toEqual({
    fingerprint: "b".repeat(32),
    publicationStatus: "archived",
  });
  expect(JSON.stringify(value)).not.toContain("PRIVATE");
});
