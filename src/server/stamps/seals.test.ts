import {describe,it,expect,vi} from 'vitest';
import {handleSeals,SealError} from './seals';
import {STAMP_OWNER} from '@/src/test/stamp';
const id='20000000-0000-4000-8000-000000000001';
const snapshot={scope:'country',countryCode:'SG',countryLabel:'Singapore',localityId:null,localitySlug:null,localityName:null,ink:'teal',eligibleShopIds:[],eligibleShops:[],template:'cartouche-v1'};
const row={id,published:true,current:snapshot,progress:{count:5,collectedIds:[],qualifyingCollectionId:'private'},award:{id,sealId:id,version:1,snapshot,earnedOn:'2026-09-01',shopId:id,unseen:true,privateDiagnostics:'no'}};
const request=(body:unknown={},origin='https://nibatlas.test',method='POST')=>new Request('https://nibatlas.test/api/v1/seals',{method,headers:{Origin:origin,'Content-Type':'application/json'},...(method==='POST'?{body:JSON.stringify(body)}:{})});
describe('geographic seal request boundaries',()=>{
 it('projects only published owner fields with private no-store',async()=>{
  const rpc=vi.fn(async()=>({rows:[{...row,user_id:'private'}],nextCursor:null}));
  const r=await handleSeals(request(),{identity:async()=>STAMP_OWNER,rpc});
  const b=await r.json();expect(r.status).toBe(200);expect(b.ownerId).toBe(STAMP_OWNER);expect(JSON.stringify(b)).not.toMatch(/private|qualifyingCollectionId/);expect(r.headers.get('cache-control')).toBe('private, no-store');
  expect(rpc).toHaveBeenCalledWith('my_geographic_seals',{p_after:null,p_ack:[]});
 });
 it('does not invoke the RPC for signed out users',async()=>{const rpc=vi.fn();expect((await handleSeals(request(),{identity:async()=>null,rpc})).status).toBe(401);expect(rpc).not.toHaveBeenCalled();});
 it.each([{userId:STAMP_OWNER},{after:'invalid'},{ack:Array(51).fill(id)}])('rejects invalid and owner supplied input',async body=>{const rpc=vi.fn();expect((await handleSeals(request(body),{identity:async()=>STAMP_OWNER,rpc})).status).toBe(400);expect(rpc).not.toHaveBeenCalled();});
 it.each(['https://other.test','null',''])('rejects cross-origin mutations %s',async origin=>{const rpc=vi.fn();expect((await handleSeals(request({},origin),{identity:async()=>STAMP_OWNER,rpc})).status).toBe(400);expect(rpc).not.toHaveBeenCalled();});
 it('does not reconcile from GET',async()=>{expect((await handleSeals(request({},undefined,'GET'),{identity:async()=>STAMP_OWNER,rpc:vi.fn()})).status).toBe(400);});
 it('bounds streamed bodies',async()=>{expect((await handleSeals(request({ack:'x'.repeat(9000)}),{identity:async()=>STAMP_OWNER,rpc:vi.fn()})).status).toBe(400);});
 it.each([['42501',403],['40001',409],['23505',409],['22023',422],['XX000',503]])('contains provider error %s',async(code,status)=>{const r=await handleSeals(request(),{identity:async()=>STAMP_OWNER,rpc:async()=>{throw new SealError(code as string);}});expect(r.status).toBe(status);expect(await r.text()).not.toContain(code);});
 it('rejects malformed published artwork rather than corrupting history',async()=>{const r=await handleSeals(request(),{identity:async()=>STAMP_OWNER,rpc:async()=>({rows:[{...row,current:{...snapshot,template:'unknown'}}],nextCursor:null})});expect(r.status).toBe(503);});
});
