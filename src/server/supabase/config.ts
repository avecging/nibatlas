export interface SupabasePublicConfig {
  readonly url: string;
  readonly publishableKey: string;
}

/**
 * Auth and public catalogue reads use the publishable key. A malformed or
 * absent pair means the feature is unavailable; it must never fall back to the
 * service role.
 */
export function readSupabasePublicConfig(): SupabasePublicConfig | null {
  const rawUrl = process.env["NEXT_PUBLIC_SUPABASE_URL"]?.trim();
  const publishableKey =
    process.env["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"]?.trim();

  if (!rawUrl || !publishableKey) {
    return null;
  }

  try {
    const url = new URL(rawUrl);

    if (
      (url.protocol !== "https:" &&
        !(url.protocol === "http:" &&
          (url.hostname === "127.0.0.1" || url.hostname === "localhost"))) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    ) {
      return null;
    }

    return {
      url: url.href.replace(/\/$/u, ""),
      publishableKey,
    };
  } catch {
    return null;
  }
}
