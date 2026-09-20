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
        stage = "catalogue_rpc";
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
        if (error) {
          // Only these fixed messages may become field errors; never expose SQL/provider details.
          const known: Record<string, {path:string;message:string}> = {
            'Locality must match country': {path:'shop.locality_id',message:'Choose a locality in the selected country.'},
            'Demo identity is permanent': {path:'shop.source_quality',message:'A demo shop must keep its Demo classification.'},
            'Invalid opening hours': {path:'shop.opening_hours',message:'Check the opening and closing times for each day.'},
            'Unknown catalogue vocabulary': {path:'types',message:'A catalogue choice changed. Reload the choices and select an available item.'},
            'Invalid source': {path:'sources',message:'Check the legacy source fields, or remove an unused new source.'},
            'Invalid alias': {path:'aliases',message:'Check the name and language tag.'},
          };
          const field = error.code === '23505' && error.message.includes('unique constraint "shops_slug_key"')
            ? {path:path === 'list' ? 'slug' : 'shop.slug',message:'This URL name is already used by another shop. Choose a different URL name.'}
            : known[error.message];
          throw new ShopOperationError(error.code, field ? [field] : []);
        }
        stage = "response";
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
