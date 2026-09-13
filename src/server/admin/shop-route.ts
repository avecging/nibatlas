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
    const gateway = await createAdminGateway();
    const session = await createSupabaseServerClient();
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
