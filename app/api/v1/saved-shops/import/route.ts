import { importSavedShops } from "@/src/server/saved-shops/http";
import { withSavedShopRoute } from "@/src/server/saved-shops/route-context";

export async function POST(request: Request): Promise<Response> {
  return withSavedShopRoute((gateway) => importSavedShops(request, gateway));
}
