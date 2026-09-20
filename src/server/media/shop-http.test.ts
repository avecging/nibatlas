// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminForbiddenError } from '@/src/server/admin/http';
import { MediaOperationError } from './http';
import { handleShopMedia, type ShopMediaGateway } from './shop-http';
const shop='71000000-0000-4000-8000-000000000001', id='71000000-0000-4000-8000-000000000002';
const row={id,kind:'photo',width:2,height:2,altText:'Photo of Demo',creditText:null,status:'draft',revision:'a'.repeat(32)};
let gateway: ShopMediaGateway;
function req(method='GET',body?:unknown,origin='https://nib.test') {
  return new Request('https://nib.test/api/media',{method,headers:{origin,'content-type':'application/json'},...(body ? {body:JSON.stringify(body)} : {})});
}
beforeEach(()=>{
  gateway={getIdentity:vi.fn(async()=>id),getAccess:vi.fn(async()=>({role:'admin'})),listAudit:vi.fn(),operation:vi.fn(async()=>[row]),
    store:{putOnce:vi.fn(),get:vi.fn(async()=>({size:4,contentType:'image/png',body:new ReadableStream({start(c){c.enqueue(new Uint8Array([1,2,3,4]));c.close();}})}))}};
});
describe('shop media authorization and delivery',()=>{
  it('denies signed-out and revoked private reads before storage',async()=>{
    gateway.getIdentity=async()=>null;
    expect((await handleShopMedia(req(),shop,id,false,gateway)).status).toBe(401);
    expect(gateway.store.get).not.toHaveBeenCalled();
  });
  it('requires admin to publish while editors may attach',async()=>{
    gateway.getAccess=async()=>({role:'editor'});
    expect((await handleShopMedia(req('POST',{action:'publish',id,revision:row.revision}),shop,null,false,gateway)).status).toBe(403);
    expect((await handleShopMedia(req('POST',{action:'attach',id}),shop,null,false,gateway)).status).toBe(200);
  });
  it('rejects foreign origins, keys, unbounded bodies and malformed revision',async()=>{
    for (const body of [{action:'attach',id,storageKey:'evil'},{action:'publish',id,revision:'bad'},{action:'attach',id,extra:'x'.repeat(3000)}])
      expect((await handleShopMedia(req('POST',body),shop,null,false,gateway)).status).toBe(400);
    expect((await handleShopMedia(req('POST',{action:'attach',id},'https://evil.test'),shop,null,false,gateway)).status).toBe(403);
    expect(gateway.operation).not.toHaveBeenCalled();
  });
  it('public endpoints can only request the safe published projection',async()=>{
    gateway.getIdentity=vi.fn(async()=>null);
    gateway.operation=vi.fn(async()=>[{id,kind:'photo',width:2,height:2,altText:row.altText,creditText:null,storageKey:'private',sourceRef:'private',revision:'private'}]);
    const r=await handleShopMedia(req(),shop,null,true,gateway);
    expect(r.status).toBe(200); expect(gateway.getIdentity).not.toHaveBeenCalled();
    expect(gateway.operation).toHaveBeenCalledWith('public_list',shop,undefined,undefined);
    expect(await r.text()).not.toMatch(/revision|status|storageKey/);
    expect((await handleShopMedia(req('POST',{action:'publish',id}),shop,null,true,gateway)).status).toBe(400);
  });
  it('streams only authorized PNG with no public cache or key disclosure',async()=>{
    gateway.operation=vi.fn(async()=>({storageKey:'staging/media/key.png'}));
    const r=await handleShopMedia(req(),shop,id,true,gateway);
    expect(r.status).toBe(200);expect(r.headers.get('cache-control')).toBe('private, no-store');
    expect(r.headers.get('x-content-type-options')).toBe('nosniff');
    expect(gateway.operation).toHaveBeenCalledTimes(2);
    expect(gateway.operation).toHaveBeenLastCalledWith('public_file',shop,id);
  });
  it('rechecks access after storage read and never sends bytes after revocation/hide',async()=>{
    gateway.operation=vi.fn().mockResolvedValueOnce({storageKey:'staging/media/key.png'}).mockRejectedValueOnce(new AdminForbiddenError());
    const r=await handleShopMedia(req(),shop,id,false,gateway);
    expect(r.status).toBe(403);expect(await r.text()).not.toContain('storageKey');
  });
  it.each([['P0002',404],['40001',409],['22023',422],['54000',429],['XX000',503]] as const)('redacts provider errors %s',async(code,status)=>{
    gateway.operation=async()=>{throw new MediaOperationError(code);};
    const r=await handleShopMedia(req(),shop,null,false,gateway);
    expect(r.status).toBe(status);expect(await r.text()).not.toContain(code);
  });
});

it('advertises implemented capabilities only on private responses and enforces removal role/revision',async()=>{
  const response=await handleShopMedia(req(),shop,null,false,gateway);
  expect((await response.json()).capabilities).toEqual(['remove','arrange']);
  const removed=await handleShopMedia(req('POST',{action:'remove',id,revision:row.revision}),shop,null,false,gateway);
  expect(removed.status).toBe(200);
  expect(gateway.operation).toHaveBeenLastCalledWith('remove',shop,id,row.revision);
  gateway.getAccess=async()=>({role:'editor'});
  expect((await handleShopMedia(req('POST',{action:'remove',id,revision:row.revision}),shop,null,false,gateway)).status).toBe(403);
});
it('validates a complete arrangement and rejects malformed, duplicated, foreign caption/revision keys',async()=>{
  const arrangement={order:[id],captions:{[id]:'墨水 <script>'},revisions:{[id]:row.revision}};
  expect((await handleShopMedia(req('POST',{action:'arrange',...arrangement}),shop,null,false,gateway)).status).toBe(200);
  expect(gateway.operation).toHaveBeenLastCalledWith('arrange',shop,undefined,undefined,arrangement);
  for (const patch of [{order:[id,id]},{order:['bad']},{captions:{[shop]:'foreign'}},{captions:{[id]:'x'.repeat(301)}},{revisions:{}},{extra:'no'}]) {
    expect((await handleShopMedia(req('POST',{action:'arrange',...arrangement,...patch}),shop,null,false,gateway)).status).toBe(400);
  }
  gateway.getAccess=async()=>({role:'editor'});
  expect((await handleShopMedia(req('POST',{action:'arrange',...arrangement}),shop,null,false,gateway)).status).toBe(403);
});
