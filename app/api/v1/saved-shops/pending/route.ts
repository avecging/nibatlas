import { completePendingSave } from "@/src/server/saved-shops/http";
import { withSavedShopRoute } from "@/src/server/saved-shops/route-context";

/**
 * Completes, at most once in durable saved state, the Save that authentication
 * interrupted. The HTTP-only continuation never enters browser JavaScript.
 */
export async function POST(request: Request): Promise<Response> {
  return withSavedShopRoute((gateway, cookies) =>
    completePendingSave(request, gateway, cookies),
  );
}
