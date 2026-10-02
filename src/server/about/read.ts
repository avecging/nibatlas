import { aboutContent } from "@/src/features/about/content";
import { DEFAULT_ABOUT } from "@/src/features/about/default-content";
import { readSupabasePublicConfig } from "@/src/server/supabase/config";
export async function readPublishedAbout() {
  const config = readSupabasePublicConfig();
  // Standalone previews have no database; configured failures never resurrect old copy.
  if (!config) {
    if (
      process.env.NEXT_PUBLIC_CATALOGUE_MODE &&
      process.env.NEXT_PUBLIC_CATALOGUE_MODE !== "fixture"
    )
      throw Error("About unavailable");
    return DEFAULT_ABOUT;
  }
  const response = await fetch(
    `${config.url}/rest/v1/rpc/read_published_about`,
    {
      method: "POST",
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
      headers: {
        apikey: config.publishableKey,
        Authorization: `Bearer ${config.publishableKey}`,
        "Content-Type": "application/json",
        "Content-Profile": "public",
      },
      body: "{}",
    },
  );
  if (!response.ok) throw Error("About unavailable");
  const data: unknown = await response.json();
  return data === null ? DEFAULT_ABOUT : aboutContent(data, true);
}
