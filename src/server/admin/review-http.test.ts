import { expect, it, vi } from 'vitest';
import { handleReview, type ReviewGateway } from './review-http';
import { AdminForbiddenError } from './http';
import { MediaOperationError } from '@/src/server/media/http';
const id='61000000-0000-4000-8000-000000000001';
const url=`https://nibatlas.test/api/v1/admin/shops/${id}/review`;
const request=()=>({id,previousId:null,reviewKey:'a'.repeat(64),choices:{photos:[],logo:null,stamp:null}});
const state=()=>({record:{id,revision:'b'.repeat(32),publicationStatus:'draft',hasChanges:false,publicationErrors:[],
  document:{shop:{name:'Synthetic review test',slug:'synthetic-review-test',source_quality:'demo',operational_status:'unknown',position_precision:'street'},sources:[],types:[],aliases:[],links:[],services:[],specialties:[],brands:[]}},
  media:[],stamps:[],availableStampIds:[],reviewKey:'a'.repeat(64),conflict:false,review:null});
function gateway(role='admin',identity:string|null=id):ReviewGateway {
  return {getIdentity:vi.fn(async()=>identity),getAccess:vi.fn(async()=>({role})),listAudit:vi.fn(),operation:vi.fn(async()=>state())};
}
function post(value:unknown=request(),origin='https://nibatlas.test') {
  return new Request(url,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(value)});
}
it.each(['admin','editor'])('allows %s review without invoking any publication action',async role=>{
  const g=gateway(role);const res=await handleReview(post(),id,g);
  expect(res.status).toBe(200);expect(g.operation).toHaveBeenCalledExactlyOnceWith(id,request());
  expect(res.headers.get('Cache-Control')).toBe('private, no-store');expect(res.headers.get('Vary')).toBe('Cookie');
});
it.each([[null,'admin',401],[id,'user',403],[id,'founder',403]] as const)('denies identity %s role %s',async(actor,role,status)=>{
  const g=gateway(role,actor);expect((await handleReview(post(),id,g)).status).toBe(status);expect(g.operation).not.toHaveBeenCalled();
});
it.each(['https://other.test','null',''])('rejects origin %s',async origin=>{
  const g=gateway();expect((await handleReview(post(request(),origin),id,g)).status).toBe(403);expect(g.operation).not.toHaveBeenCalled();
});
it.each([
 {...request(),actor:id}, {...request(),environment:'production'}, {...request(),action:'publish'},
 {...request(),previousId:undefined},{...request(),reviewKey:'client-preview-hash'},
 {...request(),choices:{photos:[id,id],logo:null,stamp:null}},
 {...request(),choices:{photos:Array(51).fill(id),logo:null,stamp:null}},
 {...request(),choices:{photos:[],logo:42,stamp:null}},
 {...request(),choices:{photos:[],logo:null,stamp:null,activate:true}},
])('rejects malformed or authority-injecting input %#',async value=>{
 const g=gateway();expect((await handleReview(post(value),id,g)).status).toBe(400);expect(g.operation).not.toHaveBeenCalled();
});
it('rejects oversized bodies, queries, invalid IDs and unsupported methods before RPC',async()=>{
 const g=gateway();
 for(const req of [post({padding:'x'.repeat(8193)}),new Request(url+'?actor='+id),new Request(url,{method:'DELETE'}),new Request(url,{method:'POST',headers:{Origin:'https://nibatlas.test'},body:'{}'})])
  expect((await handleReview(req,id,g)).status).toBe(400);
 expect((await handleReview(new Request(url),'invalid',g)).status).toBe(400);expect(g.operation).not.toHaveBeenCalled();
});
it.each([['40001',409],['23505',409],['22023',422],['P0002',404],['XX000',503]] as const)('redacts provider errors %s',async(code,status)=>{
 const g=gateway();g.operation=vi.fn(async()=>{throw new MediaOperationError(code);});
 const res=await handleReview(post(),id,g);expect(res.status).toBe(status);expect(await res.text()).not.toContain(code);
});
it('handles a SQL live-role revocation after the HTTP guard',async()=>{
 const g=gateway();g.operation=vi.fn(async()=>{throw new AdminForbiddenError();});
 expect((await handleReview(post(),id,g)).status).toBe(403);
});
it('projects nested private response fields and fails closed on invalid snapshots',async()=>{
 const g=gateway();g.operation=vi.fn(async()=>({...state(),storageKey:'PRIVATE',actor_id:id,review:{id,choices:request().choices,current:true,reviewedAt:'2026-09-28T00:00:00Z',private:'PRIVATE'},
 stamps:[{id,stampId:id,designVersion:1,kind:'generated_template',origin:'generated_template',status:'approved',ink:'teal',creatorName:null,creatorUrl:null,hasArtwork:false,active:true,revision:'a'.repeat(32),templateData:{tier:'shop',motif:'nib',secret:'PRIVATE'},storageKey:'PRIVATE'}]}));
 const res=await handleReview(new Request(url),id,g);expect(res.status).toBe(200);expect(await res.text()).not.toContain('PRIVATE');
 g.operation=vi.fn(async()=>({...state(),reviewKey:'invalid'}));expect((await handleReview(new Request(url),id,g)).status).toBe(503);
});
