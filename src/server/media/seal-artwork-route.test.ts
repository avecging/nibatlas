// @vitest-environment node
import {it,expect,vi} from 'vitest';
vi.mock('@opennextjs/cloudflare',()=>({getCloudflareContext:vi.fn()}));
vi.mock('@/src/server/supabase/server-client',()=>({createSupabaseServerClient:vi.fn()}));
import {handleSealArtwork,SealFileError,type SealFileGateway} from './seal-artwork-route';
import {validateSealSvg} from './seal-artwork';
const id='e1000000-0000-4000-8000-000000000002';
const bytes=new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 400"><path d="M0 0L10 10"/></svg>');
const hash=validateSealSvg(bytes).sha256;
const asset={id,sha256:hash,byteSize:bytes.length,contentType:'image/svg+xml',key:`staging/seals/${id}/${hash}.svg`,ready:true};
function gateway():SealFileGateway{return {identity:async()=>id,authorizeUpload:async()=>{},environment:'staging',operation:vi.fn(async()=>asset),bucket:{put:vi.fn(async()=>({})),get:vi.fn(async()=>({size:bytes.length,httpMetadata:{contentType:'image/svg+xml'},body:new Blob([bytes]).stream()}))}};}
function request(method='POST',origin='https://nibatlas.test'){return new Request('https://nibatlas.test/artwork',{method,headers:{Origin:origin,'Content-Type':'image/svg+xml'},...(method==='POST'?{body:bytes}:{})});}
it('rejects cross-origin upload before any storage or RPC work',async()=>{const g=gateway();expect((await handleSealArtwork(request('POST','https://evil.test'),id,true,g)).status).toBe(403);expect(g.operation).not.toHaveBeenCalled();});
it('denies an ordinary account before reading bytes',async()=>{const g=gateway();g.authorizeUpload=async()=>{throw new SealFileError('42501');};expect((await handleSealArtwork(request(),id,true,g)).status).toBe(403);expect(g.bucket.put).not.toHaveBeenCalled();});
it('validates, stores and reads back exact original bytes before finalizing',async()=>{const g=gateway();const r=await handleSealArtwork(request(),id,true,g);expect(r.status).toBe(201);expect(await r.json()).toEqual({id});expect(g.operation).toHaveBeenLastCalledWith('finalize',id,null);expect(g.bucket.put).toHaveBeenCalledWith(asset.key,bytes,expect.anything());});
it('does not finalize corrupted object storage',async()=>{const g=gateway();g.bucket.get=async()=>null;expect((await handleSealArtwork(request(),id,true,g)).status).toBe(503);expect(g.operation).toHaveBeenCalledTimes(1);});
it('rechecks read authorization after storage and sandboxes SVG delivery',async()=>{const g=gateway();const r=await handleSealArtwork(request('GET'),id,false,g);expect(r.status).toBe(200);expect(g.operation).toHaveBeenCalledTimes(2);expect(r.headers.get('Content-Security-Policy')).toContain('sandbox');expect(r.headers.get('Content-Type')).toBe('image/svg+xml');});
it('denies private art after role revocation during a read',async()=>{const g=gateway();let n=0;g.operation=async()=>{if(n++)throw new SealFileError('P0002');return asset;};expect((await handleSealArtwork(request('GET'),id,false,g)).status).toBe(404);});

it('identifies JPEG bytes mislabeled as PNG before registering or storing artwork',async()=>{
 const g=gateway();
 const r=await handleSealArtwork(new Request('https://nibatlas.test/artwork',{method:'POST',headers:{Origin:'https://nibatlas.test','Content-Type':'image/png'},body:new Uint8Array([0xff,0xd8,0xff,0xe0,0,16,0x4a,0x46,0x49,0x46])}),id,true,g);
 expect(r.status).toBe(422);expect(await r.json()).toEqual({error:'jpeg_artwork_not_supported'});
 expect(g.operation).not.toHaveBeenCalled();expect(g.bucket.put).not.toHaveBeenCalled();
});
