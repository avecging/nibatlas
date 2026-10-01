import {getCloudflareContext} from '@opennextjs/cloudflare';
import {createClient} from '@supabase/supabase-js';
import {createSupabaseServerClient} from '@/src/server/supabase/server-client';
import {readSupabasePublicConfig} from '@/src/server/supabase/config';
import {object,uuid} from '@/src/domain/geographic-seals';
import {InvalidMedia,MAX_MEDIA_BYTES,readBounded} from './png';
import {SealArtworkFormatMismatch,validateSealArtwork} from './seal-artwork';
import type {MediaBucket} from './r2';
const HEADERS={'Cache-Control':'private, no-store',Pragma:'no-cache',Vary:'Cookie','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; style-src 'none'; sandbox",'X-Robots-Tag':'noindex'};
export class SealFileError extends Error{constructor(readonly code:string){super('Artwork operation failed');}}
export interface SealFileGateway{identity():Promise<string|null>;authorizeUpload():Promise<void>;operation(action:string,id:string|null,seal:string|null,payload?:Record<string,unknown>):Promise<unknown>;bucket:MediaBucket;environment:string;}
function asset(value:unknown,environment:string){const a=object(value),id=uuid(a.id);if(!['staging','production'].includes(environment)||typeof a.sha256!=='string'||!/^[a-f0-9]{64}$/.test(a.sha256)||!['image/png','image/svg+xml'].includes(String(a.contentType))||!Number.isSafeInteger(a.byteSize)||(a.byteSize as number)<1||(a.byteSize as number)>MAX_MEDIA_BYTES)throw Error('Invalid asset');
 const key=`${environment}/seals/${id}/${a.sha256}.${a.contentType==='image/png'?'png':'svg'}`;if(key!==a.key)throw Error('Invalid key');return {id,key,sha256:a.sha256,contentType:a.contentType as string,byteSize:a.byteSize as number};}
export async function handleSealArtwork(request:Request,id:string,upload:boolean,gateway:SealFileGateway){
 const fail=(code:string,status:number)=>Response.json({error:code},{status,headers:HEADERS});
 try{
  try{uuid(id);}catch{return fail('invalid_request',400);}
  if(new URL(request.url).search||request.method!==(upload?'POST':'GET'))return fail('invalid_request',400);
  if(upload&&request.headers.get('origin')!==new URL(request.url).origin)return fail('forbidden',403);
  if(!await gateway.identity())return fail('authentication_required',401);
  if(upload){
   // Authorize before reading/decompressing untrusted bytes or allocating object storage.
   await gateway.authorizeUpload();
   const type=request.headers.get('content-type')??'';
   const bytes=await readBounded(request.body,type==='image/svg+xml'?512*1024:MAX_MEDIA_BYTES),meta=validateSealArtwork(bytes,type);
   const a=asset(await gateway.operation('reserve',null,id,{sha256:meta.sha256,byteSize:bytes.length,contentType:type}),gateway.environment);
   await gateway.bucket.put(a.key,bytes,{onlyIf:new Headers({'If-None-Match':'*'}),httpMetadata:{contentType:type,cacheControl:'private, no-store'}});
   const saved=await gateway.bucket.get(a.key);if(!saved||saved.size!==bytes.length||saved.httpMetadata?.contentType!==type)throw Error('Artwork not stored');
   const read=await readBounded(saved.body,MAX_MEDIA_BYTES);if(validateSealArtwork(read,type).sha256!==meta.sha256)throw Error('Artwork mismatch');
   const done=asset(await gateway.operation('finalize',a.id,null),gateway.environment);if(done.id!==a.id||done.sha256!==a.sha256)throw Error('Artwork mismatch');
   return Response.json({id:a.id},{status:201,headers:HEADERS});
  }
  const resolve=async()=>asset(await gateway.operation('read',id,null),gateway.environment);
  const a=await resolve(),stored=await gateway.bucket.get(a.key);if(!stored||stored.size!==a.byteSize||stored.httpMetadata?.contentType!==a.contentType)throw Error('Missing artwork');
  if((await resolve()).key!==a.key)throw Error('Changed artwork');
  return new Response(stored.body,{headers:{...HEADERS,'Content-Type':a.contentType,'Content-Length':String(a.byteSize)}});
 }catch(e){if(e instanceof SealArtworkFormatMismatch)return fail('jpeg_artwork_not_supported',422);const code=e instanceof SealFileError?e.code:'';return fail('artwork_unavailable',e instanceof InvalidMedia?422:code==='42501'?403:code==='P0002'?404:code==='22023'?422:503);}
}
export async function sealArtworkRoute(request:Request,id:string,upload=false){
 try{
  const session=await createSupabaseServerClient();const {data,error}=await session.auth.getClaims();const actor=!error&&typeof data?.claims.sub==='string'?data.claims.sub:null;
  if(!actor)return Response.json({error:'authentication_required'},{status:401,headers:HEADERS});
  const config=readSupabasePublicConfig(),secret=process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();const {env}=await getCloudflareContext({async:true});const binding=env as unknown as {MEDIA_BUCKET?:MediaBucket;MEDIA_ENV?:string};
  if(!config||!secret||!binding.MEDIA_BUCKET||!binding.MEDIA_ENV)throw Error('Media unavailable');
  const db=createClient(config.url,secret,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
  return handleSealArtwork(request,id,upload,{identity:async()=>actor,environment:binding.MEDIA_ENV,bucket:binding.MEDIA_BUCKET,
   async authorizeUpload(){const {data,error}=await session.rpc('admin_access');if(error||!['editor','admin'].includes(String(data?.role)))throw new SealFileError('42501');},
   async operation(action,assetId,seal,payload={}){const {data,error}=await db.rpc('geographic_seal_file',{p_actor:actor,p_environment:binding.MEDIA_ENV,p_action:action,p_id:assetId,p_seal:seal,p_payload:payload});if(error)throw new SealFileError(error.code);return data;},
  });
 }catch{return Response.json({error:'service_unavailable'},{status:503,headers:HEADERS});}
}
