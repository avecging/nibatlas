import { getCloudflareContext } from '@opennextjs/cloudflare';
import { createClient } from '@supabase/supabase-js';
import { createSupabaseServerClient } from '@/src/server/supabase/server-client';
import { readSupabasePublicConfig } from '@/src/server/supabase/config';
import { privateR2Store, type MediaBucket } from './r2';

const HEADERS = {
  'Cache-Control':'private, no-store',
  Pragma:'no-cache',
  Vary:'Cookie',
  'X-Content-Type-Options':'nosniff',
  'Content-Security-Policy':"default-src 'none'",
};
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function stampArtworkRoute(request: Request, stampId: string, rawVersion: string) {
  if (request.method!=='GET' || new URL(request.url).search || !UUID.test(stampId)
    || !/^[1-9][0-9]*$/.test(rawVersion)) {
    return Response.json({error:{code:'invalid_request'}},{status:400,headers:HEADERS});
  }
  try {
    const config=readSupabasePublicConfig(), secret=process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
    const {env}=await getCloudflareContext({async:true});
    const binding=env as unknown as {MEDIA_BUCKET?:MediaBucket;MEDIA_ENV?:string};
    if(!config || !secret || !binding.MEDIA_BUCKET || !binding.MEDIA_ENV) throw Error();
    let actor:string|null=null;
    try {
      const session=await createSupabaseServerClient();
      const {data}=await session.auth.getClaims();
      if(typeof data?.claims.sub==='string') actor=data.claims.sub;
    } catch {
      // Current public artwork is intentionally available without a session.
    }
    const db=createClient(config.url,secret,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
    const resolve=async()=>{
      const {data,error}=await db.rpc('stamp_artwork_file_operation',{
        p_actor:actor,p_environment:binding.MEDIA_ENV,p_stamp:stampId,p_version:Number(rawVersion),
      });
      if(error) {
        if(error.code==='P0002') return null;
        throw Error();
      }
      if(!data || typeof data!=='object' || Array.isArray(data) || typeof (data as Record<string,unknown>).storageKey!=='string') throw Error();
      return (data as Record<string,string>).storageKey;
    };
    const key=await resolve();
    if(!key) return Response.json({error:{code:'stamp_artwork_not_found'}},{status:404,headers:HEADERS});
    const stored=await privateR2Store(binding.MEDIA_BUCKET,binding.MEDIA_ENV).get(key);
    if(!stored || stored.contentType!=='image/png' || stored.size<1 || stored.size>5*1024*1024) throw Error();
    // Recheck current publication/ownership after the external R2 read.
    if(await resolve()!==key) return Response.json({error:{code:'stamp_artwork_not_found'}},{status:404,headers:HEADERS});
    return new Response(stored.body,{headers:{...HEADERS,'Content-Type':'image/png','Content-Length':String(stored.size)}});
  } catch {
    return Response.json({error:{code:'service_unavailable'}},{status:503,headers:HEADERS});
  }
}
