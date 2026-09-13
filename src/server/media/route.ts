import { getCloudflareContext } from '@opennextjs/cloudflare';
import { createClient } from '@supabase/supabase-js';
import { createAdminGateway } from '@/src/server/admin/route-context';
import { AdminForbiddenError, adminFailure } from '@/src/server/admin/http';
import { readSupabasePublicConfig } from '@/src/server/supabase/config';
import { handleMedia, MediaOperationError, decodeUpload } from './http';
import { privateR2Store, type MediaBucket } from './r2';

export async function mediaRoute(request: Request, id: string | null = null) {
  try {
    const gateway=await createAdminGateway();
    const actor=await gateway.getIdentity();
    if (!actor) return adminFailure('authentication_required');
    const config=readSupabasePublicConfig(), secret=process.env.SUPABASE_SERVICE_ROLE_KEY;
    const { env }=await getCloudflareContext({async:true});
    const binding=env as unknown as { MEDIA_BUCKET?: MediaBucket; MEDIA_ENV?: string };
    if (!config || !secret || !binding.MEDIA_BUCKET || !binding.MEDIA_ENV) throw Error('Media not configured');
    const server=createClient(config.url,secret,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
    return await handleMedia(request,id,{
      ...gateway, store:privateR2Store(binding.MEDIA_BUCKET,binding.MEDIA_ENV),
      async operation(action,uploadId,payload={}) {
        const {data,error}=await server.rpc('media_upload_operation',{
          p_actor:actor,p_environment:binding.MEDIA_ENV,p_action:action,p_id:uploadId,p_payload:payload,
        });
        if (error?.code==='42501') throw new AdminForbiddenError();
        if (error) throw new MediaOperationError(error.code);
        return decodeUpload(data,uploadId);
      },
    });
  } catch { return adminFailure('service_unavailable'); }
}
