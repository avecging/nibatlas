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
    if (role === "editor") {
      for (const path of ["/admin/about", "/admin/shops/import"]) {
        const denied = await context.request.get(path, { maxRedirects: 0 });
        expect(denied.status()).toBe(307);
        expect(denied.headers().location).toBe(`${origin}/me`);
      }
    } else {
      expect((await context.request.get("/admin/about")).status()).toBe(200);
      expect((await context.request.get("/admin/shops/import")).status()).toBe(200);
    }
    await page.getByLabel(/^Shop name(?: \*)?$/).fill("Explicit Worker test draft");
    await page.getByLabel("URL name · optional", { exact: true }).fill(`worker-test-${randomUUID()}`);
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
    expect(sql(`select count(*)=1 and bool_and(st.status='active' and av.approval_status='approved' and av.artwork_kind='generated_template') from public.stamps st join public.stamp_artwork_versions av on av.stamp_id=st.id where st.shop_id='${id}';`)).toBe("t");
    expect(sql(`select count(*)=3 and bool_and(actor_user_id='${actor}' and actor_kind='account') from public.admin_audit_log where entity_id in (select id from public.stamps where shop_id='${id}' union all select av.id from public.stamp_artwork_versions av join public.stamps st on st.id=av.stamp_id where st.shop_id='${id}');`)).toBe("t");
    await expect(page.getByLabel(/^Shop name(?: \*)?$/)).toHaveValue("Explicit Worker test draft");
    await page.getByLabel(/^Shop name(?: \*)?$/).fill("Edited Worker test draft");
    const saving = page.waitForResponse((response) => response.request().method() === "POST" && response.url().endsWith(`/api/v1/admin/shops/${id}`));
    await page.getByRole("button", { name: "Save", exact: true }).click();
    expect((await saving).status()).toBe(200);
    await page.reload();
    await expect(page.getByLabel(/^Shop name(?: \*)?$/)).toHaveValue("Edited Worker test draft");
    await page.getByRole("navigation", { name: "Editor sections" }).getByRole("button", { name: "Review" }).click();
    await expect(page.frameLocator('iframe[title="Saved public-page preview"]').getByRole("region", { name: "Incomplete preview" })
      .getByRole("heading", { name: "Edited Worker test draft", exact: true })).toBeVisible();
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

test("admin: expired cookie before page load is refreshed and remains usable", async ({ page, context }) => {
  await login(context, "admin");
  const previousToken = await expireCookie(context);
  await page.goto("/admin/shops");
  await expect(page.getByRole("button", { name: "Search", exact: true })).toBeEnabled();
  const refreshed = (await browserSession(context)).session;
  expect(refreshed.expires_at > Date.now() / 1000).toBe(true);
  expect(refreshed.refresh_token !== previousToken).toBe(true);
  expect((await context.request.get("/api/v1/admin/access")).status()).toBe(200);
});
for (const role of [null, "user"] as const) {
  test(`${role ?? "anonymous"}: denied at the compiled route`, async ({ context }) => {
    if (role) await login(context, role);
    expect((await context.request.get("/api/v1/admin/shops")).status()).toBe(role ? 403 : 401);
    const response = await context.request.post("/api/v1/admin/shops", { headers: { Origin: origin }, data: { action: "create", id: randomUUID(), document: { name: "Denied test", slug: `denied-${randomUUID()}` } } });
    expect(response.status()).toBe(role ? 403 : 401);
  });
}

test("ordinary and signed-out sessions cannot use direct admin reads or mutations", async ({ browser }) => {
  const id = randomUUID();
  const reads = [
    "/api/v1/admin/access", "/api/v1/admin/audit", "/api/v1/admin/shops",
    "/api/v1/admin/shops/options", `/api/v1/admin/shops/${id}`,
    `/api/v1/admin/shops/${id}/review`, `/api/v1/admin/shops/${id}/publication`,
    `/api/v1/admin/shops/${id}/media`, `/api/v1/admin/shops/${id}/media/${id}`,
    `/api/v1/admin/shops/${id}/stamp`, `/api/v1/admin/shops/${id}/stamp/${id}`,
    `/api/v1/admin/shops/${id}/verification-policy`, "/api/v1/admin/about",
    `/api/v1/admin/about/images/${id}`, "/api/v1/admin/seals",
    "/api/v1/admin/import/batches", "/api/v1/admin/import/publication",
    `/api/v1/admin/media/uploads/${id}`,
  ];
  const writes = [
    ["/api/v1/admin/shops", { action: "create", id, document: { name: "Denied" } }],
    [`/api/v1/admin/shops/${id}`, { action: "save", revision: id, document: {} }],
    [`/api/v1/admin/shops/${id}`, { action: "discard", revision: id }],
    ["/api/v1/admin/shops/options", { kind: "types", label: "Denied" }],
    [`/api/v1/admin/shops/${id}/review`, { action: "save" }],
    [`/api/v1/admin/shops/${id}/publication`, { action: "publish" }],
    [`/api/v1/admin/shops/${id}/media`, { action: "publish", id, revision: "a".repeat(32) }],
    [`/api/v1/admin/shops/${id}/media`, { action: "remove", id, revision: "a".repeat(32) }],
    [`/api/v1/admin/shops/${id}/stamp`, { action: "activate", versionId: id, revision: "a".repeat(32) }],
    [`/api/v1/admin/shops/${id}/verification-policy`, { radiusMeters: 100 }],
    ["/api/v1/admin/media/uploads", { shopId: id, purpose: "shop_photo" }],
    ["/api/v1/admin/about", { action: "publish", revision: null }],
    ["/api/v1/admin/about/images", { action: "upload" }],
    ["/api/v1/admin/seals", { action: "publish", id, revision: id }],
    ["/api/v1/admin/seals", { action: "unpublish", id, revision: id }],
    ["/api/v1/admin/import", { version: "invalid", rows: [] }],
    ["/api/v1/admin/import/batches", { action: "save", id }],
    ["/api/v1/admin/import/publication", { action: "publish", id }],
  ] as const;
  for (const role of [null, "user"] as const) {
    const context = await browser.newContext({ baseURL: origin, ignoreHTTPSErrors: true });
    try {
      if (role) await login(context, role);
      const denied = role ? 403 : 401;
      for (const path of ["/admin", "/admin/shops", "/admin/about", "/admin/seals", "/admin/shops/import"]) {
        const route = await context.request.get(path, { maxRedirects: 0 });
        expect(route.status(), `${role ?? "anonymous"} ${path}`).toBe(307);
        expect(route.headers().location).toBe(`${origin}/me`);
      }
      for (const path of reads) {
        const response = await context.request.get(path);
        expect(response.status(), `${role ?? "anonymous"} GET ${path}`).toBe(denied);
      }
      for (const [path, data] of writes) {
        const response = await context.request.post(path, { headers: { Origin: origin }, data });
        expect(response.status(), `${role ?? "anonymous"} POST ${path}`).toBe(denied);
      }
      const upload = await context.request.put(`/api/v1/admin/media/uploads/${id}`, {
        headers: { Origin: origin, "Content-Type": "image/png" }, data: Buffer.from("denied"),
      });
      expect(upload.status()).toBe(denied);
      const artwork = await context.request.post(`/api/v1/admin/seals/${id}/artwork`, {
        headers: { Origin: origin, "Content-Type": "image/png" }, data: Buffer.from("denied"),
      });
      expect(artwork.status()).toBe(denied);
    } finally { await context.close(); }
  }
});

test("admin: direct authenticated PostgREST create keeps the actor", async ({ context }) => {
  const { actor, client } = await login(context, "admin");
  const id = randomUUID();
  const result = await client.rpc("admin_shop_write", { p_action: "create", p_id: id, p_revision: null, p_document: { name: "Direct RPC test draft", slug: `rpc-test-${id}` } });
  // Only this disposable test database's error text; no Auth payloads or tokens.
  expect(result.error && { code: result.error.code, message: result.error.message }).toBeNull();
  expect(result.data.publicationStatus).toBe("draft");
  expect(sql(`select bool_and(actor_user_id='${actor}' and actor_kind='account') from public.admin_audit_log where entity_id='${id}';`)).toBe("t");
});

test('B2: source-free editorial publication through the real Worker preserves private drafts and review identity', async ({ context, page }) => {
  const { actor } = await login(context, 'editor');
  const id = randomUUID(), slug = `b2-worker-${id}`;
  const create = await context.request.post('/api/v1/admin/shops', { headers: { Origin: origin }, data: { action: 'create', id, document: { name: 'B2 synthetic Worker shop', slug } } });
  expect(create.status()).toBe(201);
  let record = await create.json();
  const options = await (await context.request.get('/api/v1/admin/shops/options')).json();
  const locality = options.localities.find((l: {countryCode: string}) => l.countryCode === 'SG');
  const document = { ...record.document, sources: [], types: [{ shop_type_id: options.types[0].id, is_primary: true }],
    shop: { ...record.document.shop, country_code: 'SG', locality_id: locality.id, timezone: 'Asia/Singapore', latitude: 0, longitude: 0,
      address_line_1: 'Synthetic Worker address', source_quality: 'demo', field_note_body: 'First paragraph.\n\n第二段。', internal_notes: 'PRIVATE WORKER SENTINEL', reference_links: 'https://example.test/private-worker' } };
  const post = (action: string, extra = {}) => context.request.post(`/api/v1/admin/shops/${id}`, { headers: { Origin: origin }, data: { action, revision: record.revision, ...extra } });
  let response = await post('save', { document });
  expect(response.status()).toBe(200); record = await response.json();
  expect(record.positionConfirmed).toBe(false);
  expect((await context.request.get(`/api/v1/shops/${slug}`)).status()).toBe(404);
  expect((await post('publish')).status()).toBe(422);
  response = await post('confirm_position'); expect(response.status()).toBe(200); record = await response.json();
  expect(record.positionConfirmed).toBe(true);
  response = await post('publish'); expect(response.status()).toBe(200); record = await response.json();
  expect(record.publicationStatus).toBe('published');
  const publicResponse = await context.request.get(`/api/v1/shops/${slug}`);
  expect(publicResponse.status()).toBe(200);
  const publicText = await publicResponse.text();
  expect(publicText).not.toMatch(/PRIVATE WORKER|private-worker/);
  expect(sql(`select reviewed_by='${actor}' and reviewed_at is not null and last_verified_at is null from public.shops where id='${id}';`)).toBe('t');
  await page.goto(`/shops/${slug}`);
  await expect(page.getByText('First paragraph.', { exact: true })).toBeVisible();
  await expect(page.getByText(/Listing reviewed by Nib Atlas/)).toBeVisible();
  response = await post('save', { document: { ...record.document, shop: { ...record.document.shop, longitude: 1 } } });
  expect(response.status()).toBe(200); record = await response.json();
  expect(record.positionConfirmed).toBe(false);
  expect((await post('publish')).status()).toBe(422);
  expect(await (await context.request.get(`/api/v1/shops/${slug}`)).text()).toBe(publicText);
  await context.clearCookies();
  expect((await context.request.get(`/api/v1/admin/shops/${id}`)).status()).toBe(401);
  expect(await (await context.request.get(`/api/v1/shops/${slug}`)).text()).toBe(publicText);
});
