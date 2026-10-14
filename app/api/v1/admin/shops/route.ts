import { shopAdminRoute } from "@/src/server/admin/shop-route";
export const dynamic = "force-dynamic";
export const GET = (request: Request) => shopAdminRoute(request, "list");
export const POST = GET;
