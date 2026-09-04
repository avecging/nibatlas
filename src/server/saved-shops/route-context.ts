import {
  type SavedShopFailure,
  type SavedShopGateway,
} from "@/src/server/saved-shops/http";
import {
  createSupabaseServerClient,
  SupabaseUnavailableError,
} from "@/src/server/supabase/server-client";

function failure(
  error: { code?: string | undefined; status?: number | undefined } | null,
): SavedShopFailure | null {
  return error
    ? {
        ...(typeof error.code === "string" ? { code: error.code } : {}),
        ...(typeof error.status === "number" ? { status: error.status } : {}),
      }
    : null;
}

export async function createSavedShopGateway(): Promise<SavedShopGateway> {
  const supabase = await createSupabaseServerClient();

  return {
    getClaims: async () => {
      const { data, error } = await supabase.auth.getClaims();

      return {
        data: data ? { claims: data.claims as Record<string, unknown> } : null,
        error: failure(error),
      };
    },
    list: async () => {
      const { data, error } = await supabase.rpc("list_saved_shops");
      return { data, error: failure(error) };
    },
    save: async (shopId) => {
      const { data, error } = await supabase.rpc("save_shop", { p_shop_id: shopId });
      return { data, error: failure(error) };
    },
    unsave: async (shopId) => {
      const { data, error } = await supabase.rpc("unsave_shop", { p_shop_id: shopId });
      return { data, error: failure(error) };
    },
  };
}

export async function withSavedShopRoute(
  handler: (gateway: SavedShopGateway) => Promise<Response>,
): Promise<Response> {
  try {
    return await handler(await createSavedShopGateway());
  } catch (error) {
    if (error instanceof SupabaseUnavailableError) {
      return Response.json(
        { ok: false, error: { code: "saved_shop_service_unavailable" } },
        {
          status: 503,
          headers: { "Cache-Control": "private, no-store", Pragma: "no-cache" },
        },
      );
    }

    throw error;
  }
}
