import {
  AboutValidationError,
  aboutContent,
  aboutObject,
  aboutState,
} from "@/src/features/about/content";
import { DEFAULT_ABOUT } from "@/src/features/about/default-content";
import { authorizeAdmin, AdminForbiddenError } from "@/src/server/admin/http";
import {
  ADMIN_HEADERS,
  ShopOperationError,
  type ShopAdminGateway,
} from "@/src/server/admin/shop-http";
import { UUID } from "@/src/features/admin/shop-contract";
const reply = (value: unknown, status = 200) =>
  Response.json(value, { status, headers: ADMIN_HEADERS });
const fail = (
  code: string,
  status: number,
  fields: { field: string; message: string }[] = [],
) => reply({ ok: false, error: { code }, fields }, status);
async function body(request: Request) {
  if (request.headers.get("content-type")?.split(";")[0] !== "application/json")
    throw Error();
  const reader = request.body?.getReader();
  if (!reader) throw Error();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 131072) {
        await reader.cancel();
        throw Error();
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return aboutObject(
    JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)),
  );
}
export async function handleAboutAdmin(
  request: Request,
  gateway: ShopAdminGateway,
) {
  try {
    const access = await authorizeAdmin(gateway, "admin");
    if (access instanceof Response) {
      for (const [k, v] of Object.entries(ADMIN_HEADERS))
        access.headers.set(k, v);
      return access;
    }
    if (new URL(request.url).search) return fail("invalid_request", 400);
    let args: Record<string, unknown> = { p_action: "read" };
    if (request.method !== "GET") {
      if (request.method !== "POST") return fail("invalid_request", 400);
      if (request.headers.get("origin") !== new URL(request.url).origin)
        return fail("forbidden", 403);
      try {
        const b = await body(request);
        if (
          !["save", "publish"].includes(String(b.action)) ||
          Object.keys(b).some(
            (k) =>
              ![
                "action",
                "revision",
                ...(b.action === "save" ? ["document"] : []),
              ].includes(k),
          ) ||
          (b.revision !== null &&
            (typeof b.revision !== "string" || !UUID.test(b.revision)))
        )
          throw Error();
        args = {
          p_action: b.action,
          p_revision: b.revision,
          ...(b.action === "save"
            ? { p_document: aboutContent(b.document) }
            : {}),
        };
      } catch (e) {
        return e instanceof AboutValidationError
          ? fail("invalid_content", 422, [
              { field: e.field, message: e.message },
            ])
          : fail("invalid_request", 400);
      }
    }
    const value = await gateway.call("admin_about_page", args);
    // Only an authorized read with no saved content receives the initial copy.
    if (value === null && request.method === "GET")
      return reply({
        revision: null,
        publishedRevision: null,
        publishedAt: null,
        draft: DEFAULT_ABOUT,
      });
    return reply(aboutState(value));
  } catch (e) {
    if (e instanceof AdminForbiddenError) return fail("forbidden", 403);
    if (e instanceof ShopOperationError && e.code === "40001")
      return fail("content_changed", 409);
    if (e instanceof ShopOperationError && ["22023", "22P02"].includes(e.code))
      return fail("invalid_content", 422);
    return fail("service_unavailable", 503);
  }
}
