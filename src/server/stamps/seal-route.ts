import {createSupabaseServerClient} from '@/src/server/supabase/server-client';
import {handleSeals, SealError, SEAL_HEADERS} from './seals';
export async function sealRoute(request:Request,admin=false) {
 try {
  const session=await createSupabaseServerClient();
  return await handleSeals(request,{
   async identity(){const {data,error}=await session.auth.getClaims();return !error&&typeof data?.claims.sub==='string'?data.claims.sub:null;},
   async rpc(name,args){const {data,error}=await session.rpc(name,args);if(error) throw new SealError(error.code);return data;},
  },admin);
 } catch {return Response.json({error:'service_unavailable'},{status:503,headers:SEAL_HEADERS});}
}
