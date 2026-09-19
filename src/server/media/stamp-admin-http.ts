import { authorizeAdmin, AdminForbiddenError, adminFailure, type AdminGateway } from '@/src/server/admin/http';
import { ADMIN_HEADERS } from '@/src/server/admin/shop-http';
import { object, UUID } from '@/src/features/admin/shop-contract';
import { decodeAdminStamps, STAMP_INKS, STAMP_ORIGINS } from '@/src/features/admin/stamp-contract';
import { readBounded } from './png';
import { MediaOperationError, type PrivateMediaStore } from './http';

export type StampAdminAction='list'|'create'|'attach'|'activate'|'preview';
export interface StampAdminGateway extends AdminGateway {
  operation(action:StampAdminAction,shopId:string,payload?:Record<string,unknown>):Promise<unknown>;
  store:PrivateMediaStore;
}
const fail=(code:string,status:number)=>Response.json({error:{code}},{status,headers:ADMIN_HEADERS});
export async function handleStampAdmin(request:Request,shopId:string,versionId:string|null,gateway:StampAdminGateway) {
  try {
    const role=await authorizeAdmin(gateway,'editor');
    if(role instanceof Response) return role;
    if(!UUID.test(shopId)||(versionId!==null&&!UUID.test(versionId))||new URL(request.url).search
      || !['GET','POST'].includes(request.method)||(versionId!==null&&request.method!=='GET')) return adminFailure('invalid_request');
    if(versionId) {
      const value=object(await gateway.operation('preview',shopId,{versionId}));
      if(typeof value.storageKey!=='string') throw Error();
      const stored=await gateway.store.get(value.storageKey);
      if(!stored||stored.contentType!=='image/png'||stored.size<1||stored.size>5*1024*1024) return fail('stamp_artwork_not_found',404);
      const recheck=object(await gateway.operation('preview',shopId,{versionId}));
      if(recheck.storageKey!==value.storageKey) return fail('stamp_artwork_not_found',404);
      return new Response(stored.body,{headers:{...ADMIN_HEADERS,'Content-Type':'image/png','Content-Length':String(stored.size),
        'X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'"}});
    }
    if(request.method==='GET') return Response.json({entries:decodeAdminStamps(await gateway.operation('list',shopId))},{headers:ADMIN_HEADERS});
    if(request.headers.get('origin')!==new URL(request.url).origin) return adminFailure('forbidden');
    if(request.headers.get('content-type')?.split(';')[0]!=='application/json') return adminFailure('invalid_request');
    let body:Record<string,unknown>;
    try {
      body=object(JSON.parse(new TextDecoder().decode(await readBounded(request.body,4096))));
      if(typeof body.action!=='string') throw Error();
      if(body.action==='create') {
        if(Object.keys(body).some(k=>!['action','origin','creatorName','creatorUrl','ink'].includes(k))
          ||!STAMP_ORIGINS.includes(body.origin as never)||!STAMP_INKS.includes(body.ink as never)
          ||typeof body.creatorName!=='string'||!body.creatorName.trim()||body.creatorName.length>300
          ||!(body.creatorUrl===undefined||(typeof body.creatorUrl==='string'&&/^https?:\/\//i.test(body.creatorUrl)&&body.creatorUrl.length<=2000))) throw Error();
      } else if(body.action==='attach') {
        if(Object.keys(body).some(k=>!['action','versionId','uploadId'].includes(k))
          ||typeof body.versionId!=='string'||!UUID.test(body.versionId)
          ||typeof body.uploadId!=='string'||!UUID.test(body.uploadId)) throw Error();
      } else if(body.action==='activate') {
        if(role!=='admin') return adminFailure('forbidden');
        if(Object.keys(body).some(k=>!['action','versionId','revision'].includes(k))
          ||typeof body.versionId!=='string'||!UUID.test(body.versionId)
          ||typeof body.revision!=='string'||!/^[a-f0-9]{32}$/.test(body.revision)) throw Error();
      } else throw Error();
    } catch { return adminFailure('invalid_request'); }
    const action=body.action as 'create'|'attach'|'activate';
    const payload={...body}; delete payload.action;
    return Response.json({entries:decodeAdminStamps(await gateway.operation(action,shopId,payload))},{headers:ADMIN_HEADERS});
  } catch(error) {
    if(error instanceof AdminForbiddenError) return adminFailure('forbidden');
    if(error instanceof MediaOperationError) {
      if(error.code==='P0002') return fail('stamp_artwork_not_found',404);
      if(error.code==='40001') return fail('revision_conflict',409);
      if(error.code==='23505') return fail('stamp_conflict',409);
      if(['22023','23514','23503','22P02'].includes(error.code)) return fail('invalid_stamp_target',422);
    }
    return adminFailure('service_unavailable');
  }
}
