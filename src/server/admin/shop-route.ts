import { createSupabaseServerClient } from "@/src/server/supabase/server-client";
import { createAdminGateway } from "./route-context";
import { AdminForbiddenError, adminFailure } from "./http";
import { handleShopAdmin, ShopOperationError, type ShopAdminStage } from "./shop-http";
export async function shopAdminRoute(
  request: Request,
  path: "list" | "options" | "shop",
  id: string | null = null,
) {
  const requestId = crypto.randomUUID();
  let stage: ShopAdminStage = "identity";
  let databaseCode: string | undefined;
  let databaseReason: string | undefined;
  let response: Response;
  try {
    const session = await createSupabaseServerClient();
    // Identity, live role and catalogue RPCs must share the request's session,
    // including a token refreshed during getClaims(). A second client can read
    // stale incoming cookies and lose the authority the guard just verified.
    const gateway = await createAdminGateway(session);
    response = await handleShopAdmin(request, path, id, {
      ...gateway,
      async call(name, args) {
        const { data, error } = await session.rpc(name, args);
        if (error) databaseCode = /^[A-Z0-9]{5}$/.test(error.code) ? error.code : "other";
        if (error?.code === "42501") {
          databaseReason = error.message === "Admin access denied" ? "role_denied"
            : error.message.startsWith("permission denied for function ") ? "function_privilege"
            : error.message.startsWith("permission denied for table ") ? "table_privilege"
            : error.message.startsWith("permission denied for schema ") ? "schema_privilege"
            : error.message.includes("row-level security") ? "row_security"
            : "other_permission";
          throw new AdminForbiddenError();
        }
        if (error) throw new ShopOperationError(error.code);
        return data;
      },
    }, (value) => { stage = value; });
  } catch {
    response = adminFailure("service_unavailable");
  }
  response.headers.set("X-Admin-Request-Id", requestId);
  response.headers.set("X-Nib-Atlas-Release", process.env.NIBATLAS_RELEASE ?? "development");
  if (!response.ok) {
    response.headers.set("X-Admin-Failure-Stage", stage);
    if (databaseReason) response.headers.set("X-Admin-Database-Reason", databaseReason);
    let originHostMatches = false;
    let originProtocolMatches = false;
    try {
      const origin = new URL(request.headers.get("origin") ?? "");
      originHostMatches = origin.hostname === new URL(request.url).hostname;
      originProtocolMatches = origin.protocol === new URL(request.url).protocol;
    } catch { /* Missing or opaque Origin remains rejected. */ }
    console.warn(JSON.stringify({ event: "shop_admin_failure", requestId, stage, status: response.status, databaseCode, databaseReason,
      originPresent: request.headers.has("origin"),
      originMatches: request.headers.get("origin") === new URL(request.url).origin,
      requestProtocol: new URL(request.url).protocol,
      requestPort: new URL(request.url).port, originHostMatches, originProtocolMatches,
    }));
  }
  return response;
}
