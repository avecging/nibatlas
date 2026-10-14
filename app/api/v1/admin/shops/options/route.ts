import { shopAdminRoute } from "@/src/server/admin/shop-route";
export const dynamic = "force-dynamic";
export const GET = (request: Request) => shopAdminRoute(request, "options");

export const POST = (request: Request) => shopAdminRoute(request, "options");
