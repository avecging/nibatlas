const RPC_TIMEOUT_MS = 8_000;

export type ShopReadRpc =
  | "viewport_shops"
  | "search_shops"
  | "shop_detail"
  | "nearby_shops";

export class ShopReadConfigurationError extends Error {
  constructor() {
    super("Public shop reads are not configured");
    this.name = "ShopReadConfigurationError";
  }
}

export class ShopReadUpstreamError extends Error {
  constructor(readonly upstreamStatus: number) {
    super("Public shop read failed");
    this.name = "ShopReadUpstreamError";
  }
}

/**
 * Narrow provider adapter for public, security-definer Supabase RPCs.
 *
 * It deliberately uses the browser-safe publishable key. The service role is
 * neither necessary nor appropriate for public catalogue reads, and granting
 * this adapter more privilege would make a route bug materially more dangerous.
 */
export async function callShopReadRpc(
  rpc: ShopReadRpc,
  args: Readonly<Record<string, unknown>>,
  requestSignal?: AbortSignal,
): Promise<unknown> {
  const baseUrl = process.env["NEXT_PUBLIC_SUPABASE_URL"]?.replace(/\/$/, "");
  const publishableKey = process.env["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"];

  if (!baseUrl || !publishableKey) {
    throw new ShopReadConfigurationError();
  }

  const controller = new AbortController();
  const abortFromRequest = () => controller.abort(requestSignal?.reason);
  const timeout = setTimeout(() => controller.abort(), RPC_TIMEOUT_MS);
  requestSignal?.addEventListener("abort", abortFromRequest, { once: true });

  if (requestSignal?.aborted) {
    abortFromRequest();
  }

  try {
    let response: Response;

    try {
      response = await fetch(`${baseUrl}/rest/v1/rpc/${rpc}`, {
        method: "POST",
        cache: "no-store",
        headers: {
          apikey: publishableKey,
          Authorization: `Bearer ${publishableKey}`,
          "Content-Type": "application/json",
          "Content-Profile": "public",
        },
        body: JSON.stringify(args),
        signal: controller.signal,
      });
    } catch {
      throw new ShopReadUpstreamError(0);
    }

    if (!response.ok) {
      // Never forward PostgREST error bodies; they may disclose database details.
      throw new ShopReadUpstreamError(response.status);
    }

    try {
      return await response.json();
    } catch {
      throw new ShopReadUpstreamError(response.status);
    }
  } finally {
    // The timeout covers the response body as well as the headers.
    clearTimeout(timeout);
    requestSignal?.removeEventListener("abort", abortFromRequest);
  }
}
