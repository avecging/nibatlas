import { getCloudflareContext } from '@opennextjs/cloudflare';
import { createClient } from '@supabase/supabase-js';
import { createSupabaseServerClient } from '@/src/server/supabase/server-client';
import { readSupabasePublicConfig } from '@/src/server/supabase/config';
import { createAdminGateway } from './route-context';
import { AdminForbiddenError, adminFailure } from './http';
import { MediaOperationError } from '@/src/server/media/http';
import { handleReview } from './review-http';

export async function reviewRoute(request: Request, shop: string) {
  try {
    const session = await createSupabaseServerClient();
    const gateway = await createAdminGateway(session);
    const actor = await gateway.getIdentity();
    if (!actor) return adminFailure('authentication_required');
    return await handleReview(request,shop,{
      ...gateway, getIdentity:async () => actor,
      async operation(id, save) {
        const config = readSupabasePublicConfig(), secret = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
        const {env} = await getCloudflareContext({async:true});
        const environment = (env as unknown as {MEDIA_ENV?:string}).MEDIA_ENV;
        if (!config || !secret || !['staging','production'].includes(environment ?? '')) throw Error();
        // Match the media boundary: actor comes only from the verified cookie,
        // environment only from this Worker. SQL rechecks/locks the live role.
        const db = createClient(config.url,secret,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
        const {data,error} = await db.rpc('shop_review_operation',{
          p_actor:actor,p_environment:environment,p_shop:id,p_save:save,
        });
        if (error?.code === '42501') throw new AdminForbiddenError();
        if (error) throw new MediaOperationError(error.code);
        return data;
      },
    });
  } catch { return adminFailure('service_unavailable'); }
}
