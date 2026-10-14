'use client';
import { useEffect, useRef, useState } from 'react';
import { UUID } from './shop-contract';
import { usePendingUpload } from './use-pending-upload';

// Preview only bounded PNGs. JPEG dimensions are checked by the server before
// decoding; their saved private image provides the preview after attachment.
function previewablePng(image:Prepared) {
  if(image.contentType!=='image/png'||image.bytes.byteLength<33)return false;
  const view=new DataView(image.bytes),width=view.getUint32(16),height=view.getUint32(20);
  return view.getUint32(8)===13 && view.getUint32(12)===0x49484452 &&
    width>0 && height>0 && width<=2048 && height<=2048;
}
type Prepared = {bytes:ArrayBuffer;contentType:'image/png'|'image/jpeg'};
type Result = {id?:unknown;entries?:unknown};
type Request = (path:string,signal:AbortSignal,options?:RequestInit)=>Promise<Result>;
const post=(value:unknown):RequestInit=>({method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(value)});
const code=(e:unknown)=>e instanceof Error && 'code' in e ? e.code : null;

/** Shared private transfer/retry state; preparation and attachment stay typed by
 * purpose. The picker is locked during a transfer, including the initial async
 * preparation, so a newer file cannot inherit an older immutable upload ID. */
export function usePrivateUpload({disabled,prepare,manifest,request,run,attach}: {
  disabled:boolean;prepare:(file:File)=>Promise<Prepared>;manifest:Record<string,unknown>;
  request:Request;run:(work:(signal:AbortSignal)=>Promise<void>)=>Promise<void>;
  attach:(id:string,signal:AbortSignal)=>Promise<void>;
}) {
  const [file,setFile]=useState<File|null>(null),[preview,setPreview]=useState('');
  const [phase,setPhase]=useState<'idle'|'preparing'|'uploading'|'saved'|'error'>('idle');
  const [error,setError]=useState('');
  const prepared=useRef<Prepared|null>(null),session=useRef<string|null>(null),lock=useRef(false),mounted=useRef(true);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
  useEffect(()=>()=>{if(preview)URL.revokeObjectURL(preview);},[preview]);
  usePendingUpload(!!file && phase!=='saved');
  const busy=phase==='preparing'||phase==='uploading';
  function save(selected:File) {
    if(disabled || lock.current)return;
    lock.current=true;
    let started=false;
    void run(async signal=>{
      started=true;
      const active=()=>mounted.current&&!signal.aborted;
      setError('');setPhase('preparing');
      try {
        if(!prepared.current)prepared.current=await prepare(selected);
        if(!active())return;
        const {bytes,contentType}=prepared.current;
        if(previewablePng(prepared.current))setPreview(URL.createObjectURL(new Blob([bytes],{type:contentType})));
        setPhase('uploading');
        const base='/api/v1/admin/media/uploads';
        if(!session.current) {
          const sha256=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
          if(!active())return;
          const value=await request(base,signal,post({...manifest,sha256,byteSize:bytes.byteLength,contentType}));
          if(typeof value.id!=='string'||!UUID.test(value.id))throw Error('The upload could not be started. Try again.');
          session.current=value.id;
        }
        const url=`${base}/${session.current}`;
        // Recover lost finalization responses before sending identical bytes again.
        try { await request(url,signal,{method:'POST'}); }
        catch(e) {
          if(code(e)!=='upload_incomplete')throw e;
          await request(url,signal,{method:'PUT',headers:{'Content-Type':contentType},body:bytes});
          await request(url,signal,{method:'POST'});
        }
        if(!active())return;
        await attach(session.current,signal);
        if(active()) {setPhase('saved');setPreview('');prepared.current=null;session.current=null;}
      } catch(e) {
        if(active()) {
          if(['upload_expired','upload_conflict'].includes(String(code(e))))session.current=null;
          setPhase('error');setError(e instanceof Error?e.message:'This file could not be saved. Try again.');
        }
      } finally {lock.current=false;}
    }).finally(()=>{
      if(!started) {
        lock.current=false;
        if(mounted.current) {setPhase('error');setError('Another change is still saving. Try again.');}
      }
    });
  }
  return {
    filename:file?.name??'',preview,error,busy,
    status:file ? `${file.name} · ${phase==='saved'?'saved privately':phase==='preparing'?'preparing…':phase==='uploading'?'saving…':'not saved'}` : '',
    select:(next:File)=>{
      if(disabled||lock.current)return;
      prepared.current=null;session.current=null;setFile(next);setPreview('');setError('');save(next);
    },
    clear:()=>{
      if(disabled||lock.current)return;
      setFile(null);setPreview('');setPhase('idle');setError('');prepared.current=null;session.current=null;
    },
    retry:phase==='error'&&file?()=>save(file):undefined,
  };
}
