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
        if (error?.code === "42501") throw new AdminForbiddenError();
        if (error) throw new ShopOperationError(error.code);
        return data;
      },
    }, (value) => { stage = value; });
  } catch {
    response = adminFailure("service_unavailable");
  }
  response.headers.set("X-Admin-Request-Id", requestId);
  if (!response.ok) {
    response.headers.set("X-Admin-Failure-Stage", stage);
    console.warn(JSON.stringify({ event: "shop_admin_failure", requestId, stage, status: response.status, databaseCode,
      originPresent: request.headers.has("origin"),
      originMatches: request.headers.get("origin") === new URL(request.url).origin,
      requestProtocol: new URL(request.url).protocol,
    }));
  }
  return response;
}
