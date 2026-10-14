import { listSavedShops } from "@/src/server/saved-shops/http";
import { withSavedShopRoute } from "@/src/server/saved-shops/route-context";

export async function GET(request: Request): Promise<Response> {
  return withSavedShopRoute((gateway) => listSavedShops(request, gateway));
}
