import { createSupabaseServerClient } from "@/src/server/supabase/server-client";
import { createAdminGateway } from "./route-context";
import { AdminForbiddenError, adminFailure } from "./http";
import { handleShopAdmin, ShopOperationError } from "./shop-http";
export async function shopAdminRoute(
  request: Request,
  path: "list" | "options" | "shop",
  id: string | null = null,
) {
  try {
    const session = await createSupabaseServerClient();
    // Identity, live role and catalogue RPCs must share the request's session,
    // including a token refreshed during getClaims(). A second client can read
    // stale incoming cookies and lose the authority the guard just verified.
    const gateway = await createAdminGateway(session);
    return await handleShopAdmin(request, path, id, {
      ...gateway,
      async call(name, args) {
        const { data, error } = await session.rpc(name, args);
        if (error?.code === "42501") throw new AdminForbiddenError();
        if (error) throw new ShopOperationError(error.code);
        return data;
      },
    });
  } catch {
    return adminFailure("service_unavailable");
  }
}
