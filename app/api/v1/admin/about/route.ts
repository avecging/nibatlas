import { createSupabaseServerClient } from "@/src/server/supabase/server-client";
import { createAdminGateway } from "@/src/server/admin/route-context";
import { AdminForbiddenError } from "@/src/server/admin/http";
import {
  ADMIN_HEADERS,
  ShopOperationError,
} from "@/src/server/admin/shop-http";
import { handleAboutAdmin } from "@/src/server/about/admin-http";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    const session = await createSupabaseServerClient();
    const gateway = await createAdminGateway(session);
    return await handleAboutAdmin(request, {
      ...gateway,
      async call(name, args) {
        const { data, error } = await session.rpc(name, args);
        if (error?.code === "42501") throw new AdminForbiddenError();
        if (error) throw new ShopOperationError(error.code);
        return data;
      },
    });
  } catch {
    return Response.json(
      { ok: false, error: { code: "service_unavailable" } },
      { status: 503, headers: ADMIN_HEADERS },
    );
  }
}
export const POST = GET;
