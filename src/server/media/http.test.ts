// @vitest-environment node
import { beforeEach,describe,it,expect,vi } from 'vitest';
import { AdminForbiddenError } from '@/src/server/admin/http';
import { handleMedia, MediaOperationError, type MediaGateway, type Upload } from './http';
import { png } from './png.fixture';
import { validatePng } from './png';
const id='70000000-0000-4000-8000-000000000001';
const actor='70000000-0000-4000-8000-000000000002';
const bytes=png(); const checked=validatePng(bytes,false);
let upload:Upload, gateway:MediaGateway;
const stream=()=>new ReadableStream<Uint8Array>({start(c){c.enqueue(bytes);c.close();}});
function req(method='GET',body?: string|Uint8Array,headers:Record<string,string>={}) {
  return new Request(`https://nib.test/api/v1/admin/media/uploads/${id}`,{method,headers:{origin:'https://nib.test',...headers},...(body === undefined ? {} : {body:body as BodyInit})});
}
const photo={shopId:id,purpose:'shop_photo',sha256:checked.sha256,byteSize:bytes.length,contentType:'image/png',sourceRef:'Founder original',rightsBasis:'Owned by photographer; permission granted',creditText:'Photographer',altText:'Entrance'};
beforeEach(()=>{
  upload={id,storageKey:`staging/media/${id}/v1/${checked.sha256}.png`,...checked,purpose:'shop_photo',status:'pending',expiresAt:new Date(Date.now()+60000).toISOString(),width:null,height:null};
  gateway={getIdentity:vi.fn(async()=>actor),getAccess:vi.fn(async()=>({role:'editor'})),listAudit:vi.fn(),
    operation:vi.fn(async(action)=>action==='finalize' ? {...upload,status:'validated' as const,width:2,height:2} : upload),
    store:{putOnce:vi.fn(async()=>{}),get:vi.fn(async()=>({size:bytes.length,contentType:'image/png',body:stream()}))}};
});
describe('private media HTTP boundary',()=>{
  it.each(['GET','PUT','POST'])('requires identity for %s',async method=>{
    gateway.getIdentity=async()=>null;
    expect((await handleMedia(req(method),id,gateway)).status).toBe(401);
    expect(gateway.operation).not.toHaveBeenCalled();expect(gateway.store.get).not.toHaveBeenCalled();
  });
  it.each(['user','admin-spoof'])('denies role %s',async role=>{
    gateway.getAccess=async()=>({role});
    expect((await handleMedia(req(),id,gateway)).status).toBe(403);
    expect(gateway.operation).not.toHaveBeenCalled();
  });
  it('initiates only a bounded valid contract and ignores no attacker fields',async()=>{
    expect((await handleMedia(req('POST',JSON.stringify(photo),{'content-type':'application/json'}),null,gateway)).status).toBe(201);
    expect(gateway.operation).toHaveBeenCalledWith('initiate',expect.any(String),photo);
    for (const invalid of [{...photo,storageKey:'evil'}, {...photo,creditText:''},{...photo,byteSize:1.5},{...photo,contentType:'image/svg+xml'},{...photo,sha256:'bad'},{...photo,purpose:'artwork_png'}]) {
      expect((await handleMedia(req('POST',JSON.stringify(invalid),{'content-type':'application/json'}),null,gateway)).status).toBe(400);
    }
  });
  it('enforces same-origin, verbs, queries and IDs',async()=>{
    expect((await handleMedia(req('PUT',bytes,{origin:'https://evil.test'}),id,gateway)).status).toBe(403);
    expect((await handleMedia(req('DELETE'),id,gateway)).status).toBe(400);
    expect((await handleMedia(req(),'../key',gateway)).status).toBe(400);
    expect((await handleMedia(new Request('https://nib.test/?key=private'),id,gateway)).status).toBe(400);
  });
  it('does not return keys or evidence, including on GET',async()=>{
    const response=await handleMedia(req(),id,gateway), text=await response.text();
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(text).not.toContain('storageKey');expect(text).not.toContain(checked.sha256);
    expect(gateway.store.get).not.toHaveBeenCalled();
  });
  it('uploads exact validated bytes and rechecks live role before R2 write',async()=>{
    expect((await handleMedia(req('PUT',bytes,{'content-type':'image/png'}),id,gateway)).status).toBe(200);
    expect(gateway.operation).toHaveBeenCalledTimes(2);
    expect(gateway.store.putOnce).toHaveBeenCalledWith(upload.storageKey,new Uint8Array(bytes));
  });
  it('rejects revocation after transfer and never writes storage',async()=>{
    gateway.operation=vi.fn().mockResolvedValueOnce(upload).mockRejectedValueOnce(new AdminForbiddenError());
    expect((await handleMedia(req('PUT',bytes,{'content-type':'image/png'}),id,gateway)).status).toBe(403);
    expect(gateway.store.putOnce).not.toHaveBeenCalled();
  });
  it('rejects mismatched upload bytes or MIME before storage',async()=>{
    for (const [body,type] of [[bytes,'image/jpeg'],[png(3,3),'image/png'],[Buffer.from('<script>'),'image/png']] as const) {
      expect((await handleMedia(req('PUT',body,{'content-type':type}),id,gateway)).status).toBe(422);
    }
    expect(gateway.store.putOnce).not.toHaveBeenCalled();
  });
  it('finalizes using freshly read and validated object bytes',async()=>{
    expect((await handleMedia(req('POST'),id,gateway)).status).toBe(200);
    expect(gateway.store.get).toHaveBeenCalledWith(upload.storageKey);
    expect(gateway.operation).toHaveBeenLastCalledWith('finalize',id,checked);
  });
  it('rejects client finalization assertions',async()=>{
    expect((await handleMedia(req('POST','{"approved":true}'),id,gateway)).status).toBe(422);
    expect(gateway.store.get).not.toHaveBeenCalled();
  });
  it('leaves incomplete uploads pending and retryable',async()=>{
    gateway.store.get=async()=>null;
    const r=await handleMedia(req('POST'),id,gateway);
    expect(r.status).toBe(409);expect(await r.text()).toContain('upload_incomplete');
    expect(gateway.operation).toHaveBeenCalledTimes(1);
  });
  it('refuses malformed stored content and does not finalize',async()=>{
    gateway.store.get=async()=>({size:bytes.length,contentType:'image/png',body:new ReadableStream({start(c){c.enqueue(new Uint8Array(bytes.length));c.close();}})});
    expect((await handleMedia(req('POST'),id,gateway)).status).toBe(422);
    expect(gateway.operation).toHaveBeenCalledTimes(1);
  });
  it('enforces expiration, and finalization is idempotent',async()=>{
    upload.expiresAt='2000-01-01T00:00:00Z';
    expect((await handleMedia(req('POST'),id,gateway)).status).toBe(410);
    upload.status='validated';
    expect((await handleMedia(req('POST'),id,gateway)).status).toBe(200);
    expect((await handleMedia(req('PUT',bytes),id,gateway)).status).toBe(409);
    expect(gateway.store.get).not.toHaveBeenCalled();
  });
  it('denies a revoked service transaction and redacts provider failures',async()=>{
    gateway.operation=async()=>{throw new AdminForbiddenError();};
    expect((await handleMedia(req('POST'),id,gateway)).status).toBe(403);
    gateway.operation=async()=>{throw new Error('secret evidence path');};
    const r=await handleMedia(req(),id,gateway);expect(r.status).toBe(503);expect(await r.text()).not.toContain('secret');
  });
  it('maps upload identity/limit errors without disclosure',async()=>{
    for (const [code,status] of [['P0002',404],['54000',429],['23514',422]] as const) {
      gateway.operation=async()=>{throw new MediaOperationError(code);};
      expect((await handleMedia(req(),id,gateway)).status).toBe(status);
    }
  });
});

it('validates and projects the service response without leaking future fields',async()=>{
  const {decodeUpload}=await import('./http');
  expect(decodeUpload({...upload,approvalEvidence:'private'},id)).not.toHaveProperty('approvalEvidence');
  for (const wrong of [{...upload,id:actor},{...upload,expiresAt:'invalid'},{...upload,byteSize:0},{...upload,width:12}]) expect(()=>decodeUpload(wrong,id)).toThrow();
});
it('new media audit summaries remain admin-only and bounded',async()=>{
  const {handleAdminRead}=await import('@/src/server/admin/http');
  gateway.listAudit=async()=>[{id,actorUserId:actor,actorKind:'account',action:'catalogue_insert',entityType:'media_uploads',entityId:id,
    before:{},after:{fingerprint:'a'.repeat(32),sourceRef:'secret'},requestId:id,createdAt:'2026-09-13T00:00:00Z'}];
  expect((await handleAdminRead(new Request('https://nib.test/audit'),'audit',gateway)).status).toBe(403);
  gateway.getAccess=async()=>({role:'admin'});
  const r=await handleAdminRead(new Request('https://nib.test/audit'),'audit',gateway);
  expect(r.status).toBe(200);expect(await r.text()).not.toContain('secret');
});
