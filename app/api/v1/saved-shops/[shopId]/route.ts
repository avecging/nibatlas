import { saveShop, unsaveShop } from "@/src/server/saved-shops/http";
import { withSavedShopRoute } from "@/src/server/saved-shops/route-context";

interface RouteContext {
  readonly params: Promise<{ shopId: string }>;
}

export async function PUT(request: Request, context: RouteContext): Promise<Response> {
  const { shopId } = await context.params;
  return withSavedShopRoute((gateway) => saveShop(request, shopId, gateway));
}

export async function DELETE(request: Request, context: RouteContext): Promise<Response> {
  const { shopId } = await context.params;
  return withSavedShopRoute((gateway) => unsaveShop(request, shopId, gateway));
}
