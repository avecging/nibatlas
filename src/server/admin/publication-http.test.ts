import { expect, it, vi } from 'vitest';
import { handlePublication, type PublicationGateway } from './publication-http';
import { AdminForbiddenError } from './http';
import { MediaOperationError } from '@/src/server/media/http';
const id='61000000-0000-4000-8000-000000000001';
const url=`https://nibatlas.test/api/v1/admin/shops/${id}/publication`;
const request=()=>({action:'publish',reviewId:id});
const state=()=>({publication:{reviewId:id,status:'complete',canRetry:false,updatedAt:'2026-09-29T00:00:00Z',outcomes:[
 {kind:'shop',targetId:id,status:'succeeded',reason:null},{kind:'stamp',targetId:null,status:'succeeded',reason:null},{kind:'logo',targetId:null,status:'succeeded',reason:null}]}});
function gateway(role='admin',identity:string|null=id):PublicationGateway {
  return {getIdentity:vi.fn(async()=>identity),getAccess:vi.fn(async()=>({role})),listAudit:vi.fn(),operation:vi.fn(async()=>state())};
}
function post(value:unknown=request(),origin='https://nibatlas.test') {
  return new Request(url,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(value)});
}
it.each(['admin'])('allows %s deliberate publication',async role=>{
  const g=gateway(role);const res=await handlePublication(post(),id,g);
  expect(res.status).toBe(200);expect(g.operation).toHaveBeenCalledExactlyOnceWith(id,request());
  expect(res.headers.get('Cache-Control')).toBe('private, no-store');expect(res.headers.get('Vary')).toBe('Cookie');
});
it.each([[null,'admin',401],[id,'user',403],[id,'founder',403],[id,'editor',403]] as const)('denies identity %s role %s',async(actor,role,status)=>{
  const g=gateway(role,actor);expect((await handlePublication(post(),id,g)).status).toBe(status);expect(g.operation).not.toHaveBeenCalled();
});
it.each(['https://other.test','null',''])('rejects origin %s',async origin=>{
  const g=gateway();expect((await handlePublication(post(request(),origin),id,g)).status).toBe(403);expect(g.operation).not.toHaveBeenCalled();
});
it.each([
 {...request(),actor:id}, {...request(),environment:'production'}, {...request(),action:'activate'},
 {...request(),reviewId:undefined},{...request(),reviewId:'client-preview-hash'},
 {...request(),choices:{photos:[],logo:null,stamp:null}},
])('rejects malformed or authority-injecting input %#',async value=>{
 const g=gateway();expect((await handlePublication(post(value),id,g)).status).toBe(400);expect(g.operation).not.toHaveBeenCalled();
});
it('rejects oversized bodies, queries, invalid IDs and unsupported methods before RPC',async()=>{
 const g=gateway();
 for(const req of [post({padding:'x'.repeat(8193)}),new Request(url+'?actor='+id),new Request(url,{method:'DELETE'}),new Request(url,{method:'POST',headers:{Origin:'https://nibatlas.test'},body:'{}'})])
  expect((await handlePublication(req,id,g)).status).toBe(400);
 expect((await handlePublication(new Request(url),'invalid',g)).status).toBe(400);expect(g.operation).not.toHaveBeenCalled();
});
it.each([['40001',409],['23505',409],['22023',422],['P0002',404],['XX000',503]] as const)('redacts provider errors %s',async(code,status)=>{
 const g=gateway();g.operation=vi.fn(async()=>{throw new MediaOperationError(code);});
 const res=await handlePublication(post(),id,g);expect(res.status).toBe(status);expect(await res.text()).not.toContain(code);
});
it('handles a SQL live-role revocation after the HTTP guard',async()=>{
 const g=gateway();g.operation=vi.fn(async()=>{throw new AdminForbiddenError();});
 expect((await handlePublication(post(),id,g)).status).toBe(403);
});
it('projects only bounded outcome fields and fails closed on invalid replies',async()=>{
 const g=gateway();g.operation=vi.fn(async()=>({publication:{...state().publication,storageKey:'PRIVATE',outcomes:state().publication.outcomes.map(x=>({...x,secret:'PRIVATE'}))}}));
 const res=await handlePublication(new Request(url),id,g);expect(res.status).toBe(200);expect(await res.text()).not.toContain('PRIVATE');
 g.operation=vi.fn(async()=>({publication:{...state().publication,outcomes:[{kind:'arbitrary'}]}}));
 expect((await handlePublication(new Request(url),id,g)).status).toBe(503);
});
it('read does not mutate; retry is explicit and only carries the durable review ID',async()=>{
 const g=gateway();await handlePublication(new Request(url),id,g);expect(g.operation).toHaveBeenCalledWith(id,null);
 await handlePublication(post({action:'retry',reviewId:id}),id,g);expect(g.operation).toHaveBeenCalledWith(id,{action:'retry',reviewId:id});
});
