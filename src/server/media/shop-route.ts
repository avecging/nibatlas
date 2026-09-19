import { getCloudflareContext } from '@opennextjs/cloudflare';
import { createClient } from '@supabase/supabase-js';
import { createAdminGateway } from '@/src/server/admin/route-context';
import { AdminForbiddenError, adminFailure } from '@/src/server/admin/http';
import { readSupabasePublicConfig } from '@/src/server/supabase/config';
import { MediaOperationError } from './http';
import { handleShopMedia } from './shop-http';
import { privateR2Store, type MediaBucket } from './r2';
export async function shopMediaRoute(request: Request, shopId: string, id: string | null = null, isPublic = false) {
  try {
    const gateway = await createAdminGateway();
    const actor = isPublic ? null : await gateway.getIdentity();
    if (!isPublic && !actor) return adminFailure('authentication_required');
    const config = readSupabasePublicConfig(), secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const {env} = await getCloudflareContext({async:true});
    const binding = env as unknown as {MEDIA_BUCKET?: MediaBucket; MEDIA_ENV?: string};
    if (!config || !secret || !binding.MEDIA_BUCKET || !binding.MEDIA_ENV) throw Error();
    const server = createClient(config.url,secret,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
    return await handleShopMedia(request,shopId,id,isPublic,{
      ...gateway, store:privateR2Store(binding.MEDIA_BUCKET,binding.MEDIA_ENV),
      async operation(action,shop,id,revision) {
        const {data,error} = await server.rpc('shop_media_operation',{
          p_actor:actor,p_environment:binding.MEDIA_ENV,p_shop:shop,p_action:action,p_id:id ?? null,p_revision:revision ?? null,
        });
        if (error?.code === '42501') throw new AdminForbiddenError();
        if (error) throw new MediaOperationError(error.code);
        return data;
      },
    });
  } catch { return adminFailure('service_unavailable'); }
}
