import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/src/server/supabase/server-client";
import { readSupabasePublicConfig } from "@/src/server/supabase/config";
import { authorizeAdmin } from "@/src/server/admin/http";
import { createAdminGateway } from "@/src/server/admin/route-context";
import type { MediaBucket } from "@/src/server/media/r2";
import type { PhotoImages } from "@/src/server/media/jpeg";
import { handleAboutImage, AboutImageError } from "./images";
export async function aboutImageRoute(
  request: Request,
  id: string | null = null,
  privateRead = false,
) {
  try {
    const config = readSupabasePublicConfig();
    if (!config) throw Error();
    const needsAdmin = id === null || privateRead;
    const session = needsAdmin ? await createSupabaseServerClient() : null;
    const gateway = session ? await createAdminGateway(session) : null;
    const actor = gateway ? await gateway.getIdentity() : null;
    if (gateway) {
      const access = await authorizeAdmin(gateway, "admin");
      if (access instanceof Response) return access;
    }
    const { env } = await getCloudflareContext({ async: true });
    const binding = env as unknown as {
      MEDIA_BUCKET?: MediaBucket;
      MEDIA_ENV?: string;
      PHOTO_IMAGES?: PhotoImages;
    };
    if (!binding.MEDIA_BUCKET || !binding.MEDIA_ENV) throw Error();
    const secret =
      id === null ? process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() : undefined;
    if (id === null && !secret) throw Error();
    const db =
      id === null
        ? createClient(config.url, secret!, {
            auth: {
              persistSession: false,
              autoRefreshToken: false,
              detectSessionInUrl: false,
            },
          })
        : (session ??
          createClient(config.url, config.publishableKey, {
            auth: {
              persistSession: false,
              autoRefreshToken: false,
              detectSessionInUrl: false,
            },
          }));
    return await handleAboutImage(
      request,
      id,
      {
        bucket: binding.MEDIA_BUCKET,
        environment: binding.MEDIA_ENV,
        images: binding.PHOTO_IMAGES,
        async authorize() {
          if (!gateway) throw new AboutImageError("42501");
          const a = await authorizeAdmin(gateway, "admin");
          if (a instanceof Response) return a;
        },
        async operation(action, imageId, payload = {}) {
          const { data, error } = await (action === "read"
            ? db.rpc("read_about_image", {
                p_id: imageId,
                p_private: privateRead,
              })
            : db.rpc("about_image_operation", {
                p_actor: actor,
                p_environment: binding.MEDIA_ENV,
                p_action: action,
                p_id: imageId,
                p_payload: payload,
              }));
          if (error) throw new AboutImageError(error.code);
          return data;
        },
      },
      privateRead,
    );
  } catch {
    return Response.json(
      { error: { code: "service_unavailable" } },
      {
        status: 503,
        headers: {
          "Cache-Control": "private, no-store",
          "X-Robots-Tag": "noindex",
        },
      },
    );
  }
}
