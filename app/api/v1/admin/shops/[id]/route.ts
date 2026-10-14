import { shopAdminRoute } from "@/src/server/admin/shop-route";
export const dynamic = "force-dynamic";
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return shopAdminRoute(request, "shop", (await context.params).id);
}
export const POST = GET;
