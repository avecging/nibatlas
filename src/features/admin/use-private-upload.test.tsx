import {act,renderHook,waitFor} from '@testing-library/react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {png} from '@/src/server/media/png.fixture';
import {webcrypto} from 'node:crypto';
import {usePrivateUpload} from './use-private-upload';
import {useHasPendingUploads} from './use-pending-upload';

const uploadId='73000000-0000-4000-8000-000000000010';
class Failure extends Error {constructor(readonly code:string){super(code);}}
beforeEach(()=>{
 vi.stubGlobal('crypto',webcrypto);
 vi.stubGlobal('URL', {createObjectURL:vi.fn(()=> 'blob:preview'),revokeObjectURL:vi.fn()});
});
afterEach(()=>vi.unstubAllGlobals());
function setup() {
 const controller=new AbortController();
 const prepare=vi.fn(async()=>({bytes:Uint8Array.from(png(2,2)).buffer,contentType:'image/png' as const}));
 let finalized=false;
 const request=vi.fn(async(path:string,_signal:AbortSignal,init:RequestInit={})=>{
  if(path.endsWith('/uploads'))return {id:uploadId};
  if(init.method==='PUT'){finalized=true;return {};}
  if(!finalized)throw new Failure('upload_incomplete');
  return {};
 });
 const attach=vi.fn(async()=>{});
 const options={disabled:false,prepare,request,attach,manifest:{shopId:'shop',purpose:'artwork_png'},run:async(work:(s:AbortSignal)=>Promise<void>)=>{await work(controller.signal);}};
 const hook=renderHook(()=>({upload:usePrivateUpload(options),pending:useHasPendingUploads()}));
 return {...hook,prepare,request,attach,controller,options};
}
it('retains identical bytes and upload identity across a lost attachment response',async()=>{
 const s=setup();s.attach.mockRejectedValueOnce(Error('response lost'));
 act(()=>s.result.current.upload.select(new File(['png'],'art.png')));
 await waitFor(()=>expect(s.result.current.upload.error).toBe('response lost'));
 expect(s.result.current.pending).toBe(true);
 expect(s.result.current.upload.status).toBe('art.png · not saved');
 act(()=>s.result.current.upload.retry?.());
 await waitFor(()=>expect(s.result.current.upload.status).toBe('art.png · saved privately'));
 expect(s.result.current.pending).toBe(false);
 expect(s.prepare).toHaveBeenCalledTimes(1);
 expect(s.request.mock.calls.filter(([path])=>path.endsWith('/uploads'))).toHaveLength(1);
 expect(s.request.mock.calls.filter(([, ,init])=>init?.method==='PUT')).toHaveLength(1);
 expect(s.attach).toHaveBeenCalledTimes(2);
 expect(s.attach.mock.calls[0]).toEqual(s.attach.mock.calls[1]);
 expect(URL.revokeObjectURL).toHaveBeenCalled();
});
it('starts a new identity for an expired session but retains prepared bytes',async()=>{
 const s=setup();s.request.mockImplementationOnce(async()=>({id:uploadId}));s.request.mockRejectedValueOnce(new Failure('upload_expired'));
 act(()=>s.result.current.upload.select(new File(['png'],'art.png')));
 await waitFor(()=>expect(s.result.current.upload.error).toBe('upload_expired'));
 act(()=>s.result.current.upload.retry?.());
 await waitFor(()=>expect(s.result.current.upload.status).toContain('saved privately'));
 expect(s.prepare).toHaveBeenCalledTimes(1);
 expect(s.request.mock.calls.filter(([path])=>path.endsWith('/uploads'))).toHaveLength(2);
});
it('does not allow replacement or clearing while preparing; abort prevents upload after late preparation',async()=>{
 const s=setup();let finish!:(value:Awaited<ReturnType<typeof s.prepare>>)=>void;
 s.prepare.mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}));
 act(()=>s.result.current.upload.select(new File(['one'],'first.png')));
 expect(s.result.current.upload.busy).toBe(true);
 act(()=>{s.result.current.upload.select(new File(['two'],'second.png'));s.result.current.upload.clear();});
 expect(s.result.current.upload.filename).toBe('first.png');
 s.controller.abort();s.unmount();
 await act(async()=>finish({bytes:new ArrayBuffer(4),contentType:'image/png'}));
 expect(s.request).not.toHaveBeenCalled();
});
it('keeps validation errors at the file and clears unsaved status on discard',async()=>{
 const s=setup();s.prepare.mockRejectedValueOnce(Error('Use PNG'));
 act(()=>s.result.current.upload.select(new File(['bad'],'bad.jpg')));
 await waitFor(()=>expect(s.result.current.upload.error).toBe('Use PNG'));
 expect(s.result.current.pending).toBe(true);expect(s.request).not.toHaveBeenCalled();
 act(()=>s.result.current.upload.clear());
 expect(s.result.current.upload.filename).toBe('');expect(s.result.current.pending).toBe(false);
 act(()=>s.result.current.upload.select(new File(['good'],'good.png')));
 await waitFor(()=>expect(s.result.current.upload.status).toBe('good.png · saved privately'));
});
it('offers retry when another parent operation prevented transfer from starting',async()=>{
 const s=setup();s.options.run=async()=>{};s.rerender();
 act(()=>s.result.current.upload.select(new File(['png'],'art.png')));
 await waitFor(()=>expect(s.result.current.upload.error).toContain('Another change'));
 expect(s.result.current.upload.retry).toBeDefined();expect(s.request).not.toHaveBeenCalled();
});

it('does not decode raw JPEG previews before server validation',async()=>{
 const s=setup();s.prepare.mockResolvedValueOnce({bytes:new Uint8Array([255,216,255,217]).buffer,contentType:'image/jpeg'} as unknown as Awaited<ReturnType<typeof s.prepare>>);
 s.attach.mockRejectedValueOnce(Error('not saved'));
 act(()=>s.result.current.upload.select(new File(['jpeg'],'phone.jpg')));
 await waitFor(()=>expect(s.result.current.upload.error).toBe('not saved'));
 expect(URL.createObjectURL).not.toHaveBeenCalled();expect(s.result.current.upload.preview).toBe('');
});
