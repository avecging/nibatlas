import { expect, test } from "@playwright/test";

test("direct anonymous admin endpoints disclose no privileged data", async ({
  request,
}) => {
  for (const path of ["access", "audit"]) {
    const result = await request.get(`/api/v1/admin/${path}`);
    expect(result.status()).toBe(401);
    expect(result.headers()["cache-control"]).toBe("private, no-store");
    expect(await result.json()).toEqual({
      ok: false,
      error: { code: "authentication_required" },
    });
    expect(
      (
        await request.post(`/api/v1/admin/${path}`, { data: { role: "admin" } })
      ).status(),
    ).toBe(405);
  }
});

test("anonymous shop administration operations expose no catalogue data", async ({
  request,
}) => {
  for (const path of [
    "shops",
    "shops/options",
    "shops/00000000-0000-4000-8000-000000000303",
  ]) {
    const result = await request.get(`/api/v1/admin/${path}`);
    expect(result.status()).toBe(401);
    expect(result.headers()["cache-control"]).toBe("private, no-store");
    expect(await result.json()).toEqual({
      ok: false,
      error: { code: "authentication_required" },
    });
  }
  const result = await request.post(
    "/api/v1/admin/shops/00000000-0000-4000-8000-000000000303",
    { data: { action: "publish", role: "admin" } },
  );
  expect(result.status()).toBe(401);
});
