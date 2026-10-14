// @vitest-environment node
import { createDecipheriv, createHmac } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { handleStampRequest, type StampGateway } from './http';
import { STAMP_FAILURE_STATUS } from '@/src/api/v1/stamp-verification';
const userId='10000000-0000-4000-8000-000000000001';
const shopId='00000000-0000-4000-8000-000000000301';
const requestId='20000000-0000-4000-8000-000000000001';
const binding={shopId,requestId,nonce:'a'.repeat(64)};
const position={latitude:1.23456789,longitude:103.987654321,accuracy:100};
const key='b'.repeat(128);
const collection={id:requestId,shopId,stampId:userId,collectedAt:'2026-09-12T10:00:00Z',shopTimezone:'Asia/Singapore',shopName:'Demo',place:{countryCode:'SG',localitySlug:'singapore'},stamp:{id:userId}};
function gateway(code='confirmation_required'): StampGateway {
  return {getIdentity:vi.fn(async()=>userId),rateLimit:vi.fn(async()=>true),action:vi.fn(async input=>
    input.action.startsWith('context_')? {code:'context',key,countryCode:'SG'}:{code,...(['success','duplicate'].includes(code)?{collection}:{})})};
}
function req(input:unknown, headers:Record<string,string>={}) {
  return new Request('https://nibatlas.test/api/v1/stamps/verify',{method:'POST',headers:{origin:'https://nibatlas.test','content-type':'application/json',...headers},body:JSON.stringify(input)});
}
describe('stamp verification HTTP contract',()=>{
  it('creates unpredictable bound nonce without leaking private provider fields',async()=>{
    const g=gateway('nonce_issued');
    const a=await (await handleStampRequest(req({shopId}),'nonce',g)).json();
    const b=await (await handleStampRequest(req({shopId}),'nonce',g)).json();
    expect(a).toMatchObject({ok:true,status:'nonce_issued'});
    expect(a.nonce).toMatch(/^[a-f0-9]{64}$/); expect(a.nonce).not.toBe(b.nonce);
    expect(a.requestId).not.toBe(b.requestId);
    expect(g.action).toHaveBeenCalledWith(expect.objectContaining({userId,shopId,nonceHash:expect.any(String)}));
    expect(Object.keys(a).sort()).toEqual(['nonce','ok','requestId','status']);
  });
  it('encrypts position before RPC, with independent authenticated encryption keys',async()=>{
    const g=gateway();
    const response=await handleStampRequest(req({...binding,position}),'verify',g);
    expect(await response.json()).toEqual({ok:true,status:'confirmation_required'});
    const calls=vi.mocked(g.action).mock.calls;
    const payload=calls[1]?.[0].payload as {iv:string;ciphertext:string;mac:string};
    expect(JSON.stringify(calls)).not.toContain(String(position.latitude));
    expect(JSON.stringify(calls)).not.toContain(String(position.longitude));
    const iv=Buffer.from(payload.iv,'hex'), ciphertext=Buffer.from(payload.ciphertext,'hex'), keys=Buffer.from(key,'hex');
    expect(createHmac('sha256',keys.subarray(32)).update(iv).update(ciphertext).digest('hex')).toBe(payload.mac);
    const decrypt=createDecipheriv('aes-256-cbc',keys.subarray(0,32),iv);
    expect(JSON.parse(Buffer.concat([decrypt.update(ciphertext),decrypt.final()]).toString())).toEqual(position);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
  });
  it.each(Object.entries(STAMP_FAILURE_STATUS))('returns stable %s without private fields',async(code,status)=>{
    const g=gateway(code);
    const response=await handleStampRequest(req({...binding,position}),'verify',g);
    expect(response.status).toBe(status);
    expect(await response.json()).toEqual({ok:false,error:{code}});
    expect(response.headers.get('cache-control')).toContain('no-store');
  });
  it('requires explicit confirmation and derives country label from server context',async()=>{
    const g=gateway('success');
    expect((await handleStampRequest(req(binding),'collect',g)).status).toBe(400);
    expect(g.action).not.toHaveBeenCalled();
    const response=await handleStampRequest(req({...binding,confirmedAtShop:true}),'collect',g);
    expect(await response.json()).toMatchObject({ok:true,status:'success',collection,invalidate:['collections','visited-shops','passport']});
    expect(g.action).toHaveBeenLastCalledWith(expect.objectContaining({payload:{confirmedAtShop:true,countryLabel:'Singapore'}}));
  });
  it('returns existing collection for duplicate without issuing again',async()=>{
    const g=gateway();vi.mocked(g.action).mockResolvedValue({code:'duplicate',collection});
    const r=await handleStampRequest(req({...binding,position}),'verify',g);
    expect(await r.json()).toMatchObject({status:'duplicate',collection});expect(g.action).toHaveBeenCalledTimes(1);
  });
  it('supports permission denial without any position',async()=>{
    const g=gateway('permission_denied');
    expect((await handleStampRequest(req({...binding,permission:'denied'}),'verify',g)).status).toBe(403);
    expect(g.action).toHaveBeenLastCalledWith(expect.objectContaining({payload:{permission:'denied'}}));
  });
  it.each([{userId}, {timestamp:Date.now()}, {distance:0}, {stampId:userId}, {snapshot:{}}, {position:{...position,timestamp:Date.now()}}])('rejects authority or timestamp supplied by browser: %j',async(extra)=>{
    const g=gateway(); expect((await handleStampRequest(req({...binding,position,...extra}),'verify',g)).status).toBe(400);
    expect(g.action).not.toHaveBeenCalled();
  });
  it.each([{...position,latitude:91},{...position,longitude:-181},{...position,accuracy:-1},{...position,accuracy:'100'},{...position,latitude:null}])('rejects invalid position',async(p)=>{
    expect((await handleStampRequest(req({...binding,position:p}),'verify',gateway())).status).toBe(400);
  });
  it('checks CSRF, identity, and durable rate limit before parsing coordinates',async()=>{
    const g=gateway();expect((await handleStampRequest(req({}, {origin:'https://evil.test'}),'nonce',g)).status).toBe(403);
    expect(g.getIdentity).not.toHaveBeenCalled();
    vi.mocked(g.getIdentity).mockResolvedValue(null);
    expect((await handleStampRequest(req({shopId}),'nonce',g)).status).toBe(401);expect(g.rateLimit).not.toHaveBeenCalled();
    vi.mocked(g.getIdentity).mockResolvedValue(userId);vi.mocked(g.rateLimit).mockResolvedValue(false);
    expect((await handleStampRequest(req('invalid'),'verify',g)).status).toBe(429);expect(g.action).not.toHaveBeenCalled();
  });
  it('rejects malformed and oversized bodies',async()=>{
    const malformed=new Request('https://nibatlas.test/api/v1/stamps/verify',{method:'POST',headers:{origin:'https://nibatlas.test','content-type':'application/json'},body:'{'});
    expect((await handleStampRequest(malformed,'verify',gateway())).status).toBe(400);
    expect((await handleStampRequest(req({x:'x'.repeat(2100)}),'verify',gateway())).status).toBe(400);
  });
  it('suppresses upstream exceptions and diagnostic fields',async()=>{
    const g=gateway();vi.mocked(g.action).mockRejectedValue(new Error(JSON.stringify(position)));
    const logs=[vi.spyOn(console,'error'),vi.spyOn(console,'log'),vi.spyOn(console,'warn')];
    expect(await (await handleStampRequest(req({...binding,position}),'verify',g)).json()).toEqual({ok:false,error:{code:'service_unavailable'}});
    logs.forEach(log=>{expect(log).not.toHaveBeenCalled();log.mockRestore();});
    vi.mocked(g.action).mockResolvedValue({code:'outside_radius',distance:987,radius:150,position});
    expect(await (await handleStampRequest(req({...binding,position}),'verify',g)).json()).toEqual({ok:false,error:{code:'outside_radius'}});
  });
});
