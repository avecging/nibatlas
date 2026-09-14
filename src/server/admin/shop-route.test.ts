// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const cookieStore = vi.hoisted(() => ({ getAll: vi.fn(), set: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => cookieStore }));

// Use the actual SSR client, cookie adapter, gateways and HTTP guard. Only the
// external Auth/PostgREST responses are fixtures; SQL tests cover the real RPCs.
import { shopAdminRoute } from "./shop-route";
import { adminReadRoute } from "./route-context";

const actor = "61000000-0000-4000-8000-000000000003";
const shop = "61000000-0000-4000-8000-000000000090";
const base = "https://nibatlas.test/api/v1/admin";
const cookieName = "sb-fixture-auth-token";
const jwt = (expires: number) =>
  [{ alg: "HS256", typ: "JWT" }, { sub: actor, role: "authenticated", exp: expires }, "test-only"]
    .map((value) => Buffer.from(typeof value === "string" ? value : JSON.stringify(value)).toString("base64url"))
    .join(".");

function fixture(role: string | null, expired = false) {
  const expires = Math.floor(Date.now() / 1000) + 3600;
  const token = jwt(expires);
  const session = { access_token: token, refresh_token: "refreshed-test-token", expires_at: expires, expires_in: 3600, token_type: "bearer", user: { id: actor } };
  const incoming = role === null ? [] : [{ name: cookieName, value: "base64-" + Buffer.from(JSON.stringify({
    ...session,
    access_token: expired ? jwt(expires - 7200) : token,
    expires_at: expired ? expires - 7200 : expires,
    refresh_token: "incoming-test-token",
  })).toString("base64url") }];
  // Response cookie writes do not rewrite the incoming request snapshot. The
  // client that refreshed owns the current session until the next request.
  cookieStore.getAll.mockReturnValue(incoming);
  let refreshes = 0;
  let currentRole = role;
  const calls: string[] = [];
  let record = {
    id: shop, revision: "a".repeat(32), publicationStatus: "draft", hasChanges: false,
    document: { shop: { name: "Explicit demo draft", slug: "explicit-demo-draft", source_quality: "demo", operational_status: "unknown", position_precision: "locality" }, sources: [], types: [], aliases: [], links: [], services: [], specialties: [], brands: [] },
    publicationErrors: ["Prepare approved artwork."],
  };
  vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const path = new URL(String(input)).pathname;
    if (path === "/auth/v1/token") {
      refreshes++;
      return refreshes === 1 ? Response.json(session) : Response.json({ error_code: "refresh_token_already_used", msg: "Test refresh already consumed" }, { status: 400 });
    }
    const authenticated = new Headers(init?.headers).get("Authorization") === `Bearer ${token}`;
    if (path === "/auth/v1/user")
      return authenticated ? Response.json(session.user) : Response.json({ msg: "Invalid test session" }, { status: 401 });
    const name = path.split("/").at(-1)!;
    calls.push(name);
    if (!authenticated || !["admin", "editor"].includes(currentRole ?? ""))
      return Response.json({ code: "42501", message: "Admin access denied" }, { status: 403 });
    if (name === "admin_access") return Response.json({ role: currentRole });
    if (name === "list_admin_audit") return Response.json(currentRole === "admin" ? [] : { code: "42501" }, { status: currentRole === "admin" ? 200 : 403 });
    if (name === "admin_shop_list") return Response.json([{ id: shop, name: record.document.shop.name, slug: record.document.shop.slug, publicationStatus: "draft", operationalStatus: "unknown", hasChanges: record.hasChanges }]);
    if (name === "admin_shop_options") return Response.json({ localities: [], types: [], services: [], specialties: [], brands: [] });
    if (name === "admin_shop_write") {
      const args = JSON.parse(String(init?.body));
      if (args.p_action === "save") record = { ...record, document: args.p_document, hasChanges: true, revision: "b".repeat(32) };
    }
    return Response.json(record);
  }));
  return { calls, refreshes: () => refreshes, revoke: () => { currentRole = "user"; } };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://fixture.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test_fixture");
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

it.each(["admin", "editor"])("%s keeps the refreshed session from the role check through catalogue access", async (role) => {
  const state = fixture(role, true);
  const result = await shopAdminRoute(new Request(`${base}/shops`), "list");
  expect(result.status).toBe(200);
  expect((await result.json()).entries[0].id).toBe(shop);
  expect(state.refreshes()).toBe(1);
  expect(cookieStore.set).toHaveBeenCalled();
  expect(state.calls).toEqual(["admin_access", "admin_shop_list"]);
});

it.each([[null, 401], ["user", 403], ["founder", 403]] as const)("rejects role %s before catalogue RPCs", async (role, status) => {
  const state = fixture(role);
  for (const path of ["list", "options", "shop"] as const)
    expect((await shopAdminRoute(new Request(`${base}/shops`), path, path === "shop" ? shop : null)).status).toBe(status);
  expect((await shopAdminRoute(new Request(`${base}/shops`, {
    method: "POST", headers: { Origin: "https://nibatlas.test", "Content-Type": "application/json" },
    body: JSON.stringify({ action: "create", id: shop, document: { name: "Denied test draft", slug: "denied-test-draft" } }),
  }), "list")).status).toBe(status);
  expect(state.calls.every((name) => name === "admin_access")).toBe(true);
});

it.each(["admin", "editor"])("%s can create, save, reopen and preview through the cookie-bound routes", async (role) => {
  const state = fixture(role);
  expect(await (await adminReadRoute(new Request(`${base}/access`), "access")).json()).toEqual({ role });
  const write = (path: "list" | "shop", data: unknown) => shopAdminRoute(new Request(`${base}/shops`, {
    method: "POST", headers: { Origin: "https://nibatlas.test", "Content-Type": "application/json" }, body: JSON.stringify(data),
  }), path, path === "shop" ? shop : null);
  const created = await write("list", { action: "create", id: shop, document: { name: "Explicit demo draft", slug: "explicit-demo-draft" } });
  expect(created.status).toBe(201);
  const record = await created.json();
  record.document.shop.name = "Edited demo draft";
  expect((await write("shop", { action: "save", revision: record.revision, document: record.document })).status).toBe(200);
  const reopened = await shopAdminRoute(new Request(`${base}/shops/${shop}`), "shop", shop);
  expect(reopened.status).toBe(200);
  expect((await reopened.json()).document.shop.name).toBe("Edited demo draft");
  expect((await shopAdminRoute(new Request(`${base}/shops/options`), "options")).status).toBe(200);
  expect((await adminReadRoute(new Request(`${base}/audit`), "audit")).status).toBe(role === "admin" ? 200 : 403);
  state.revoke();
  expect((await shopAdminRoute(new Request(`${base}/shops`), "list")).status).toBe(403);
});
