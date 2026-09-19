// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminForbiddenError } from '@/src/server/admin/http';
import { MediaOperationError } from './http';
import { handleStampAdmin, type StampAdminGateway } from './stamp-admin-http';
const shop='71000000-0000-4000-8000-000000000001', id='71000000-0000-4000-8000-000000000002';
const row={id,stampId:shop,designVersion:2,kind:'uploaded',origin:'ai_assisted',status:'draft',ink:'teal',creatorName:'Gin',creatorUrl:null,hasArtwork:true,active:false,revision:'a'.repeat(32)};
let gateway: StampAdminGateway;
function req(method='GET',body?:unknown,origin='https://nib.test') {
  return new Request('https://nib.test/api/stamp',{method,headers:{origin,'content-type':'application/json'},...(body ? {body:JSON.stringify(body)} : {})});
}
beforeEach(()=>{
  gateway={getIdentity:vi.fn(async()=>id),getAccess:vi.fn(async()=>({role:'admin'})),listAudit:vi.fn(),operation:vi.fn(async()=>[row]),
    store:{putOnce:vi.fn(),get:vi.fn(async()=>({size:4,contentType:'image/png',body:new ReadableStream({start(c){c.enqueue(new Uint8Array([1,2,3,4]));c.close();}})}))}};
});
describe('stamp workflow authorization',()=>{
  it('denies signed-out and revoked users before storage or operations',async()=>{
    gateway.getIdentity=async()=>null;
    expect((await handleStampAdmin(req(),shop,id,gateway)).status).toBe(401);
    gateway.getIdentity=async()=>id; gateway.getAccess=async()=>({role:'user'});
    expect((await handleStampAdmin(req(),shop,id,gateway)).status).toBe(403);
    expect(gateway.store.get).not.toHaveBeenCalled(); expect(gateway.operation).not.toHaveBeenCalled();
  });
  it('allows minimal truthful drafts and attachment but reserves activation for admins',async()=>{
    gateway.getAccess=async()=>({role:'editor'});
    expect((await handleStampAdmin(req('POST',{action:'create',origin:'ai_assisted',creatorName:'Gin',ink:'teal'}),shop,null,gateway)).status).toBe(200);
    expect(gateway.operation).toHaveBeenCalledWith('create',shop,{origin:'ai_assisted',creatorName:'Gin',ink:'teal'});
    expect((await handleStampAdmin(req('POST',{action:'attach',versionId:id,uploadId:id}),shop,null,gateway)).status).toBe(200);
    expect((await handleStampAdmin(req('POST',{action:'activate',versionId:id,revision:row.revision}),shop,null,gateway)).status).toBe(403);
    gateway.getAccess=async()=>({role:'admin'});
    expect((await handleStampAdmin(req('POST',{action:'activate',versionId:id,revision:row.revision}),shop,null,gateway)).status).toBe(200);
  });
  it('rejects unsafe links, forged fields, unbounded bodies and foreign origins',async()=>{
    const draft={action:'create',origin:'founder_created',creatorName:'Gin',ink:'teal'};
    for(const body of [{...draft,creatorUrl:'javascript:alert(1)'},{...draft,storageKey:'evil'},{...draft,creatorName:'x'.repeat(5000)},{action:'activate',versionId:id,revision:'bad'}])
      expect((await handleStampAdmin(req('POST',body),shop,null,gateway)).status).toBe(400);
    expect((await handleStampAdmin(req('POST',draft,'https://evil.test'),shop,null,gateway)).status).toBe(403);
    expect(gateway.operation).not.toHaveBeenCalled();
  });
  it('streams PNG privately only after rechecking current authority',async()=>{
    gateway.operation=vi.fn(async()=>({storageKey:'staging/media/key.png'}));
    const r=await handleStampAdmin(req(),shop,id,gateway);
    expect(r.status).toBe(200);expect(r.headers.get('cache-control')).toBe('private, no-store');
    expect(r.headers.get('x-content-type-options')).toBe('nosniff');
    expect(gateway.operation).toHaveBeenCalledTimes(2);
    gateway.operation=vi.fn().mockResolvedValueOnce({storageKey:'staging/media/key.png'}).mockRejectedValueOnce(new AdminForbiddenError());
    expect((await handleStampAdmin(req(),shop,id,gateway)).status).toBe(403);
  });
  it.each([['P0002',404],['40001',409],['22023',422],['23505',409],['54000',429],['XX000',503]] as const)('redacts provider errors %s',async(code,status)=>{
    gateway.operation=async()=>{throw new MediaOperationError(code);};
    const r=await handleStampAdmin(req(),shop,null,gateway);
    expect(r.status).toBe(status);expect(await r.text()).not.toContain(code);
  });
});

describe('generated default preparation',()=>{
  it('allows editors to request only the fixed idempotent operation',async()=>{
    gateway.getAccess=async()=>({role:'editor'});
    const r=await handleStampAdmin(req('POST',{action:'ensure_default'}),shop,null,gateway);
    expect(r.status).toBe(200);
    expect(r.headers.get('cache-control')).toBe('private, no-store');
    expect(gateway.operation).toHaveBeenCalledWith('ensure_default',shop,{});
    expect(gateway.store.putOnce).not.toHaveBeenCalled();
  });
  it.each([{action:'ensure_default',actor:id},{action:'ensure_default',ink:'teal'},{action:'ensure_default',replace:true}])('rejects caller control over defaults %j',async body=>{
    expect((await handleStampAdmin(req('POST',body),shop,null,gateway)).status).toBe(400);
    expect(gateway.operation).not.toHaveBeenCalled();
  });
  it('checks origin and revocation without allowing a replay to bypass either',async()=>{
    expect((await handleStampAdmin(req('POST',{action:'ensure_default'},'https://evil.test'),shop,null,gateway)).status).toBe(403);
    gateway.operation=vi.fn(async()=>{throw new AdminForbiddenError();});
    expect((await handleStampAdmin(req('POST',{action:'ensure_default'}),shop,null,gateway)).status).toBe(403);
  });
});
