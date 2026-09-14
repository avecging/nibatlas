import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createServerClient } from "@supabase/ssr";
import { test, expect, type BrowserContext } from "@playwright/test";

const origin = "https://localhost:8787";
function sql(query: string) {
  return execFileSync("docker", ["exec", "-i", "supabase_db_nibatlas", "psql", "-U", "postgres", "-d", "postgres", "-At", "-v", "ON_ERROR_STOP=1"], { input: query, encoding: "utf8" }).trim();
}
function uuid(value: string) {
  if (!/^[a-f0-9-]{36}$/.test(value)) throw Error("Invalid fixture ID");
  return value;
}
async function login(context: BrowserContext, role: "admin" | "editor" | "user") {
  const jar = new Map<string, string>();
  const client = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    cookies: {
      encode: "tokens-only",
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll: (values) => { for (const { name, value } of values) jar.set(name, value); },
    },
  });
  const email = `worker-test-${randomUUID()}@example.invalid`;
  const password = randomUUID();
  const signup = await client.auth.signUp({ email, password });
  if (signup.error || !signup.data.user) throw Error("Local test signup failed");
  const actor = uuid(signup.data.user.id);
  // Fixture setup only, on disposable local Supabase. All application calls
  // below use this user's genuine Auth session and the public API key.
  sql(`update auth.users set email_confirmed_at=now() where id='${actor}'; update public.profiles set role='${role}' where id='${actor}';`);
  const signedIn = await client.auth.signInWithPassword({ email, password });
  if (signedIn.error || !signedIn.data.session) throw Error("Local test login failed");
  await context.addCookies([...jar].filter(([, value]) => value).map(([name, value]) => ({ name, value, url: origin, httpOnly: true, secure: true, sameSite: "Lax" as const })));
  return { actor, client };
}
async function browserSession(context: BrowserContext) {
  const cookies = (await context.cookies()).filter((cookie) => /-auth-token(?:\.\d+)?$/.test(cookie.name));
  if (!cookies[0]) throw Error("Browser did not receive an Auth session cookie");
  const encoded = cookies.sort((a, b) => a.name.localeCompare(b.name)).map((cookie) => cookie.value).join("");
  const session = JSON.parse(Buffer.from(encoded.slice("base64-".length), "base64url").toString());
  return { cookies, session };
}
async function expireCookie(context: BrowserContext) {
  const { cookies, session } = await browserSession(context);
  const previousRefreshToken: string = session.refresh_token;
  // Keep both genuine GoTrue tokens. Expiring only the stored session timestamp
  // forces SSR to exercise the real refresh endpoint at the next POST boundary.
  session.expires_at = 1;
  const value = "base64-" + Buffer.from(JSON.stringify(session)).toString("base64url");
  const name = cookies[0]!.name.replace(/\.\d+$/, "");
  await context.clearCookies({ name: /-auth-token(?:\.\d+)?$/ });
  await context.addCookies([{ name, value, url: origin, httpOnly: true, secure: true, sameSite: "Lax" }]);
  return previousRefreshToken;
}
for (const role of ["admin", "editor"] as const) {
  test(`${role}: browser list → real refresh on create → save → reopen and attributed audit`, async ({ page, context }) => {
    const { actor, client } = await login(context, role);
    await page.goto("/admin/shops");
    await expect(page.getByRole("button", { name: "Search", exact: true })).toBeEnabled();
    await page.getByText("Create a draft shop", { exact: true }).click();
    await page.getByLabel("Shop name", { exact: true }).fill("Explicit Worker test draft");
    await page.getByLabel("URL name", { exact: true }).fill(`worker-test-${randomUUID()}`);
    const previousRefreshToken = await expireCookie(context);
    const creating = page.waitForResponse((response) => response.request().method() === "POST" && response.url().endsWith("/api/v1/admin/shops"));
    await page.getByRole("button", { name: "Create draft", exact: true }).click();
    const created = await creating;
    // Only safe status/stage metadata in failure output, never cookie values.
    expect({ status: created.status(), stage: created.headers()["x-admin-failure-stage"] }).toEqual({ status: 201, stage: undefined });
    expect((await created.headersArray()).some((header) => header.name.toLowerCase() === "set-cookie")).toBe(true);
    // Creation deliberately performs a full navigation. Read the new URL, not
    // a response body that Chromium discards when the old document unloads.
    await expect(page).toHaveURL(/\/admin\/shops\/[a-f0-9-]{36}$/);
    const refreshed = (await browserSession(context)).session;
    expect(refreshed.expires_at > Date.now() / 1000).toBe(true);
    expect(refreshed.refresh_token !== previousRefreshToken).toBe(true);
    const id = uuid(new URL(page.url()).pathname.split("/").at(-1)!);
    await expect(page.getByLabel("Shop name", { exact: true })).toHaveValue("Explicit Worker test draft");
    await page.getByLabel("Shop name", { exact: true }).fill("Edited Worker test draft");
    const saving = page.waitForResponse((response) => response.request().method() === "POST" && response.url().endsWith(`/api/v1/admin/shops/${id}`));
    await page.getByRole("button", { name: "Save changes privately" }).click();
    expect((await saving).status()).toBe(200);
    await page.reload();
    await expect(page.getByLabel("Shop name", { exact: true })).toHaveValue("Edited Worker test draft");
    await page.getByRole("button", { name: "Preview saved version", exact: true }).click();
    expect(sql(`select publication_status='draft' from public.shops where id='${id}';`)).toBe("t");
    expect(sql(`select count(*)>=1 and bool_and(actor_user_id='${actor}' and actor_kind='account') from public.admin_audit_log where entity_id='${id}' and action='catalogue_insert';`)).toBe("t");
    // A role change must still be enforced with a valid, already issued token.
    sql(`update public.profiles set role='user' where id='${actor}';`);
    const denied = await context.request.post("/api/v1/admin/shops", { headers: { Origin: origin }, data: { action: "create", id: randomUUID(), document: { name: "Denied test", slug: `denied-${randomUUID()}` } } });
    expect(denied.status()).toBe(403);
    const rpc = await client.rpc("admin_shop_write", { p_action: "create", p_id: randomUUID(), p_document: { name: "Denied test", slug: `denied-${randomUUID()}` } });
    expect(rpc.error?.code).toBe("42501");
  });
}
for (const role of [null, "user"] as const) {
  test(`${role ?? "anonymous"}: denied at the compiled route`, async ({ context }) => {
    if (role) await login(context, role);
    expect((await context.request.get("/api/v1/admin/shops")).status()).toBe(role ? 403 : 401);
    const response = await context.request.post("/api/v1/admin/shops", { headers: { Origin: origin }, data: { action: "create", id: randomUUID(), document: { name: "Denied test", slug: `denied-${randomUUID()}` } } });
    expect(response.status()).toBe(role ? 403 : 401);
  });
}

test("admin: direct authenticated PostgREST create keeps the actor", async ({ context }) => {
  const { actor, client } = await login(context, "admin");
  const id = randomUUID();
  const result = await client.rpc("admin_shop_write", { p_action: "create", p_id: id, p_revision: null, p_document: { name: "Direct RPC test draft", slug: `rpc-test-${id}` } });
  // Only this disposable test database's error text; no Auth payloads or tokens.
  expect(result.error && { code: result.error.code, message: result.error.message }).toBeNull();
  expect(result.data.publicationStatus).toBe("draft");
  expect(sql(`select bool_and(actor_user_id='${actor}' and actor_kind='account') from public.admin_audit_log where entity_id='${id}';`)).toBe("t");
});
