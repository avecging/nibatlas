import { getCloudflareContext } from '@opennextjs/cloudflare';
import { createClient } from '@supabase/supabase-js';
import { createAdminGateway } from '@/src/server/admin/route-context';
import { AdminForbiddenError, adminFailure } from '@/src/server/admin/http';
import { readSupabasePublicConfig } from '@/src/server/supabase/config';
import { MediaOperationError } from './http';
import { handleStampAdmin, type StampAdminAction } from './stamp-admin-http';
import { privateR2Store, type MediaBucket } from './r2';

export async function stampAdminRoute(request:Request,shopId:string,versionId:string|null=null) {
  try {
    const gateway=await createAdminGateway();
    const actor=await gateway.getIdentity();
    if(!actor) return adminFailure('authentication_required');
    const config=readSupabasePublicConfig(),secret=process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
    const {env}=await getCloudflareContext({async:true});
    const binding=env as unknown as {MEDIA_BUCKET?:MediaBucket;MEDIA_ENV?:string};
    if(!config||!secret||!binding.MEDIA_BUCKET||!binding.MEDIA_ENV) throw Error();
    const db=createClient(config.url,secret,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
    return handleStampAdmin(request,shopId,versionId,{
      ...gateway,store:privateR2Store(binding.MEDIA_BUCKET,binding.MEDIA_ENV),
      async operation(action:StampAdminAction,shop:string,payload:Record<string,unknown>={}) {
        const {data,error}=await db.rpc('stamp_artwork_draft_operation',{
          p_actor:actor,p_environment:binding.MEDIA_ENV,p_shop:shop,p_action:action,p_payload:payload,
        });
        if(error?.code==='42501') throw new AdminForbiddenError();
        if(error) throw new MediaOperationError(error.code);
        return data;
      },
    });
  } catch { return adminFailure('service_unavailable'); }
}
