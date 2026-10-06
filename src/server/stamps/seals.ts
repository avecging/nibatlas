import { adminSeal, object, sealDocument, sealSnapshot, sealWire, uuid } from '@/src/domain/geographic-seals';
import {isCountryCode} from '@/src/domain/geo';
export const SEAL_HEADERS={'Cache-Control':'private, no-store',Pragma:'no-cache',Vary:'Cookie','X-Robots-Tag':'noindex'};
export class SealError extends Error { constructor(readonly code:string) {super('Seal request failed');} }
export interface SealGateway {identity():Promise<string|null>;rpc(name:string,args:Record<string,unknown>):Promise<unknown>}
async function body(request:Request):Promise<Record<string,unknown>> {
 if(request.headers.get('origin')!==new URL(request.url).origin || request.headers.get('content-type')?.split(';')[0]!=='application/json') throw new SealError('invalid_request');
 const reader=request.body?.getReader(); if(!reader) throw new SealError('invalid_request');
 let size=0; const chunks:Uint8Array[]=[];
 try { for(;;) {const {value,done}=await reader.read();if(done) break;size+=value.byteLength;if(size>8192) {await reader.cancel();throw new SealError('invalid_request');} chunks.push(value);} }
 finally {reader.releaseLock();}
 const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
 return object(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes)));
}
export async function handleSeals(request:Request,gateway:SealGateway,admin=false):Promise<Response> {
 const reply=(value:unknown,status=200)=>Response.json(value,{status,headers:SEAL_HEADERS});
 try {
  const owner=await gateway.identity(); if(!owner) return reply({error:'authentication_required'},401); uuid(owner);
  const params=new URL(request.url).searchParams;
  let args:Record<string,unknown>,name:string;
  try {
   if(admin && request.method==='GET') {
    if([...params.keys()].some(k=>!['after','q','scope','country','id','history','before'].includes(k)||params.getAll(k).length>1)) throw Error();
    const q=params.get('q')??'',scope=params.get('scope')??'',country=params.get('country')??'';
    if(q.length>100||(scope&&!['country','locality'].includes(scope))||(country&&!isCountryCode(country)))throw Error();
    const id=params.has('id')?uuid(params.get('id')):null, history=params.get('history');
    if((history!==null&&history!=='1')||(history&&!id)|| (params.has('before')&&(!history||!/^\d{1,9}$/.test(params.get('before')!))))throw Error();
    name='admin_geographic_seals_v2';args={p_action:history?'history':id?'get':'list',p_id:id,p_after:params.has('after')?uuid(params.get('after')):null,p_query:q,p_scope:scope,p_country:country,p_before:params.has('before')?Number(params.get('before')):null};
   } else {
    if(request.method!=='POST' || params.size) throw Error();
    const b=await body(request);
    if(admin) {
     if(Object.keys(b).some(k=>!['action','id','revision','document'].includes(k)) || !['save','publish','unpublish'].includes(String(b.action))) throw Error();
     name='admin_geographic_seals_v2';args={p_action:b.action,p_id:b.id==null?null:uuid(b.id),p_revision:b.revision==null?null:uuid(b.revision),p_document:b.action==='save'?sealDocument(b.document):null};
    } else {
     if(Object.keys(b).some(k=>!['after','ack'].includes(k)) || (b.ack!==undefined && (!Array.isArray(b.ack) || b.ack.length>50))) throw Error();
     name='my_geographic_seals';args={p_after:b.after==null?null:uuid(b.after),p_ack:Array.isArray(b.ack)?b.ack.map(uuid):[]};
    }
   }
  } catch {return reply({error:'invalid_request'},400);}
  const data=await gateway.rpc(name,args);
  if(admin) {
   if(request.method==='POST'||params.has('id')&&!params.has('history')) return reply({seal:adminSeal(data)});
   if(params.has('history')) {
    if(!Array.isArray(data)||data.length>21)throw Error('Invalid history');
    const entries=data.slice(0,20).map(v=>{const r=object(v);if(!Number.isSafeInteger(r.version)||(r.version as number)<1)throw Error('Invalid version');return {version:r.version as number,snapshot:sealSnapshot(r.snapshot)};});
    return reply({entries,nextBefore:data.length>20?entries.at(-1)!.version:null});
   }
   if(!Array.isArray(data) || data.length>51) throw Error('Invalid page');
   const entries=data.slice(0,50).map(adminSeal);return reply({entries,nextCursor:data.length>50?entries.at(-1)!.id:null});
  }
  const d=object(data);if(!Array.isArray(d.rows) || d.rows.length>50) throw Error('Invalid page');
  // Decode/reproject before returning: provider fields and verification diagnostics stay private.
  return reply({ownerId:owner,rows:d.rows.map(sealWire),nextCursor:d.nextCursor==null?null:uuid(d.nextCursor)});
 } catch(e) {
  const code=e instanceof SealError?e.code:'';
  const status=code==='42501'?403:code==='PT409'||code==='23505'?409:['22023','22P02'].includes(code)?422:503;
  return reply({error:status===409?'reload_changed_seal':status===422?'invalid_seal':status===403?'forbidden':'service_unavailable'},status);
 }
}
