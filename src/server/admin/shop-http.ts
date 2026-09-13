import {
  authorizeAdmin,
  AdminForbiddenError,
  adminFailure,
  type AdminGateway,
} from "./http";
import {
  decodeList,
  decodeOptions,
  decodeShop,
  document,
  object,
  UUID,
} from "@/src/features/admin/shop-contract";
export interface ShopAdminGateway extends AdminGateway {
  call(name: string, args?: Record<string, unknown>): Promise<unknown>;
}
export class ShopOperationError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}
export const ADMIN_HEADERS = {
  "Cache-Control": "private, no-store",
  Pragma: "no-cache",
  Vary: "Cookie",
  "X-Robots-Tag": "noindex, nofollow",
};
const json = (value: unknown, status = 200) =>
  Response.json(value, { status, headers: ADMIN_HEADERS });
async function body(request: Request): Promise<Record<string, unknown>> {
  if (request.headers.get("content-type")?.split(";")[0] !== "application/json")
    throw Error("Invalid request");
  const reader = request.body?.getReader();
  if (!reader) throw Error("Invalid request");
  let size = 0;
  const chunks: Uint8Array[] = [];
  for (;;) {
    const c = await reader.read();
    if (c.done) break;
    size += c.value.byteLength;
    if (size > 131072) {
      await reader.cancel();
      throw Error("Too large");
    }
    chunks.push(c.value);
  }
  const bytes = new Uint8Array(size);
  let at = 0;
  for (const c of chunks) {
    bytes.set(c, at);
    at += c.length;
  }
  return object(JSON.parse(new TextDecoder().decode(bytes)));
}
export async function handleShopAdmin(
  request: Request,
  path: "list" | "options" | "shop",
  id: string | null,
  gateway: ShopAdminGateway,
): Promise<Response> {
  try {
    const role = await authorizeAdmin(gateway, "editor");
    if (role instanceof Response) return role;
    const params = new URL(request.url).searchParams;
    if (id !== null && !UUID.test(id)) return adminFailure("invalid_request");
    if (request.method === "GET") {
      if (path === "list") {
        const after = params.get("after"),
          query = params.get("q") ?? "";
        if (
          [...params.keys()].some((k) => !["after", "q"].includes(k)) ||
          params.getAll("after").length > 1 ||
          params.getAll("q").length > 1 ||
          (after !== null && !UUID.test(after)) ||
          query.length > 120
        )
          return adminFailure("invalid_request");
        const rows = decodeList(
          await gateway.call("admin_shop_list", {
            p_after: after,
            p_query: query,
          }),
        );
        const entries = rows.slice(0, 50);
        return json({
          entries,
          nextCursor: rows.length > 50 ? entries.at(-1)?.id : null,
        });
      }
      if ([...params].length) return adminFailure("invalid_request");
      return json(
        path === "options"
          ? decodeOptions(await gateway.call("admin_shop_options"))
          : decodeShop(await gateway.call("admin_shop_read", { p_id: id })),
      );
    }
    if (request.method !== "POST" || path === "options" || [...params].length)
      return adminFailure("invalid_request");
    if (request.headers.get("origin") !== new URL(request.url).origin)
      return adminFailure("forbidden");
    let data: Record<string, unknown>;
    try {
      data = await body(request);
      if (
        Object.keys(data).some(
          (k) => !["action", "revision", "document", "id"].includes(k),
        )
      )
        throw Error("Invalid request");
      if (path === "list") {
        if (
          data.action !== "create" ||
          typeof data.id !== "string" ||
          !UUID.test(data.id) ||
          data.revision !== undefined
        )
          throw Error("Invalid create");
        const d = object(data.document);
        if (
          Object.keys(d).some((k) => !["name", "slug"].includes(k)) ||
          typeof d.name !== "string" ||
          !d.name.trim() ||
          d.name.length > 300 ||
          typeof d.slug !== "string" ||
          d.slug.length > 120 ||
          !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(d.slug)
        )
          throw Error("Invalid create");
      } else {
        if (
          data.id !== undefined ||
          typeof data.action !== "string" ||
          ![
            "save",
            "publish",
            "discard",
            "temporarily_closed",
            "permanently_closed",
            "open",
            "unknown",
            "archive",
          ].includes(data.action) ||
          typeof data.revision !== "string" ||
          !/^([a-f0-9]{32}|[a-f0-9-]{36})$/i.test(data.revision)
        )
          throw Error("Invalid action");
        if (data.action === "save") data.document = document(data.document);
        else if (data.document !== undefined)
          throw Error("Unexpected document");
      }
    } catch {
      return adminFailure("invalid_request");
    }
    const result = await gateway.call("admin_shop_write", {
      p_action: data.action,
      p_id: id ?? data.id,
      p_revision: data.revision ?? null,
      p_document: data.document ?? null,
    });
    const value = object(result);
    if (
      value.code === "publication_incomplete" &&
      Array.isArray(value.requirements) &&
      value.requirements.length <= 10 &&
      value.requirements.every((v) => typeof v === "string" && v.length <= 300)
    )
      return json(
        {
          ok: false,
          error: { code: "publication_incomplete" },
          requirements: value.requirements,
        },
        422,
      );
    return json(decodeShop(result), path === "list" ? 201 : 200);
  } catch (error) {
    if (error instanceof AdminForbiddenError) return adminFailure("forbidden");
    if (error instanceof ShopOperationError) {
      const codes: Record<string, [number, string]> = {
        "40001": [409, "revision_conflict"],
        "23505": [409, "duplicate_record"],
        P0002: [404, "shop_not_found"],
        "22023": [422, "invalid_data_or_transition"],
        "23514": [422, "invalid_data_or_transition"],
        "23503": [422, "invalid_reference"],
        "22P02": [422, "invalid_data_or_transition"],
        "22007": [422, "invalid_data_or_transition"],
        "22008": [422, "invalid_data_or_transition"],
      };
      const match = codes[error.code];
      if (match)
        return json({ ok: false, error: { code: match[1] } }, match[0]);
    }
    return adminFailure("service_unavailable");
  }
}
