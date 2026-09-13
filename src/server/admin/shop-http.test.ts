import { describe, it, expect, vi } from "vitest";
import {
  handleShopAdmin,
  ShopOperationError,
  type ShopAdminGateway,
} from "./shop-http";
import { AdminForbiddenError } from "./http";
import { document, decodeShop } from "@/src/features/admin/shop-contract";
const id = "60000000-0000-4000-8000-000000000001",
  revision = "a".repeat(32);
const doc = {
  shop: {
    name: "Explicit demo draft",
    slug: "demo-draft",
    source_quality: "demo",
    operational_status: "unknown",
    position_precision: "locality",
  },
  sources: [],
  types: [],
  aliases: [],
  links: [],
  services: [],
  specialties: [],
  brands: [],
};
const record = {
  id,
  revision,
  publicationStatus: "draft",
  hasChanges: false,
  document: doc,
  publicationErrors: ["Add sourced coordinates."],
};
const gateway = (role = "editor"): ShopAdminGateway => ({
  getIdentity: vi.fn(async () => id),
  getAccess: vi.fn(async () => ({ role })),
  listAudit: vi.fn(),
  call: vi.fn(async () => record),
});
function req(body?: unknown, origin = "https://nibatlas.test", path = "") {
  return new Request(
    `https://nibatlas.test/api/v1/admin/shops${path}`,
    body
      ? {
          method: "POST",
          headers: { Origin: origin, "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      : {},
  );
}
describe("shop admin boundary", () => {
  it("denies unauthenticated and normal accounts before all data calls", async () => {
    for (const g of [
      gateway("user"),
      { ...gateway(), getIdentity: async () => null },
    ]) {
      const r = await handleShopAdmin(req(), "shop", id, g);
      expect([401, 403]).toContain(r.status);
      expect(g.call).not.toHaveBeenCalled();
    }
  });
  it("allows editor and admin, keeps output private and projected", async () => {
    for (const role of ["editor", "admin"]) {
      const g = gateway(role);
      const r = await handleShopAdmin(req(), "shop", id, g);
      expect(r.status).toBe(200);
      expect(r.headers.get("cache-control")).toBe("private, no-store");
      expect((await r.json()).document.shop.appointment_required).toBeNull();
    }
  });
  it("rejects cross-origin and missing-origin mutations", async () => {
    for (const origin of ["https://evil.test", ""]) {
      const g = gateway();
      expect(
        (
          await handleShopAdmin(
            req({ action: "publish", revision }, origin),
            "shop",
            id,
            g,
          )
        ).status,
      ).toBe(403);
      expect(g.call).not.toHaveBeenCalled();
    }
  });
  it("rejects unknown fields, invalid ids, methods and extra query values", async () => {
    for (const body of [
      { action: "save", revision, document: { ...doc, admin: true } },
      {
        action: "save",
        revision,
        document: {
          ...doc,
          shop: { ...doc.shop, publication_status: "published" },
        },
      },
      { action: "publish", revision, document: doc },
      { action: "delete", revision },
      { action: "publish", revision: "bad" },
    ]) {
      const g = gateway();
      expect((await handleShopAdmin(req(body), "shop", id, g)).status).toBe(
        400,
      );
      expect(g.call).not.toHaveBeenCalled();
    }
    expect(
      (
        await handleShopAdmin(
          req(undefined, undefined, "?role=admin"),
          "shop",
          id,
          gateway(),
        )
      ).status,
    ).toBe(400);
  });
  it("bounded body reader rejects oversized input before RPC", async () => {
    const g = gateway();
    expect(
      (
        await handleShopAdmin(
          req({ action: "save", revision, document: "x".repeat(132000) }),
          "shop",
          id,
          g,
        )
      ).status,
    ).toBe(400);
    expect(g.call).not.toHaveBeenCalled();
  });
  it("fresh DB revocation defeats the already-passed HTTP role check", async () => {
    const g = gateway();
    g.call = vi.fn(async () => {
      throw new AdminForbiddenError();
    });
    expect(
      (
        await handleShopAdmin(
          req({ action: "publish", revision }),
          "shop",
          id,
          g,
        )
      ).status,
    ).toBe(403);
  });
  it("passes only the narrow validated mutation and revision", async () => {
    const g = gateway();
    expect(
      (
        await handleShopAdmin(
          req({ action: "save", revision, document: doc }),
          "shop",
          id,
          g,
        )
      ).status,
    ).toBe(200);
    expect(g.call).toHaveBeenCalledWith("admin_shop_write", {
      p_action: "save",
      p_id: id,
      p_revision: revision,
      p_document: document(doc),
    });
  });
  it("reports conflicts and validation errors without provider facts", async () => {
    for (const [code, status] of [
      ["40001", 409],
      ["23505", 409],
      ["23503", 422],
      ["22023", 422],
      ["P0002", 404],
      ["XX000", 503],
    ] as const) {
      const g = gateway();
      g.call = vi.fn(async () => {
        throw new ShopOperationError(code);
      });
      const r = await handleShopAdmin(
        req({ action: "archive", revision }),
        "shop",
        id,
        g,
      );
      expect(r.status).toBe(status);
      expect(await r.text()).not.toContain(code);
    }
  });
  it("publishing incomplete data returns actionable requirements", async () => {
    const g = gateway();
    g.call = vi.fn(async () => ({
      code: "publication_incomplete",
      requirements: ["Prepare approved artwork."],
    }));
    const r = await handleShopAdmin(
      req({ action: "publish", revision }),
      "shop",
      id,
      g,
    );
    expect(r.status).toBe(422);
    expect((await r.json()).requirements).toEqual([
      "Prepare approved artwork.",
    ]);
  });
  it("creates a draft without inventing geography or dates", async () => {
    const g = gateway();
    expect(
      (
        await handleShopAdmin(
          req({
            action: "create",
            id,
            document: { name: "Demo", slug: "demo" },
          }),
          "list",
          null,
          g,
        )
      ).status,
    ).toBe(201);
    expect(g.call).toHaveBeenCalledWith("admin_shop_write", {
      p_action: "create",
      p_id: id,
      p_revision: null,
      p_document: { name: "Demo", slug: "demo" },
    });
  });
  it("bounds and paginates a list, with explicit fields", async () => {
    const g = gateway();
    g.call = vi.fn(async () =>
      Array.from({ length: 51 }, () => ({
        id,
        name: "Demo",
        slug: "demo",
        publicationStatus: "draft",
        operationalStatus: "unknown",
        hasChanges: false,
        secret: "omit",
      })),
    );
    const r = await handleShopAdmin(req(), "list", null, g);
    const value = await r.json();
    expect(value.entries).toHaveLength(50);
    expect(value.nextCursor).toBe(id);
    expect(JSON.stringify(value)).not.toContain("secret");
  });
  it("rejects malformed provider documents and date/choice values", () => {
    expect(() =>
      decodeShop({
        ...record,
        document: { ...doc, shop: { ...doc.shop, source_quality: "invented" } },
      }),
    ).toThrow();
    expect(() =>
      document({
        ...doc,
        shop: { ...doc.shop, last_verified_at: "yesterday" },
      }),
    ).toThrow();
    expect(() =>
      document({ ...doc, shop: { ...doc.shop, latitude: "0" } }),
    ).toThrow();
  });
});
