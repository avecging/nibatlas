'use client';
import { validCreatorCredit } from '@/src/domain/creator-credit';
/* eslint-disable @next/next/no-img-element -- private stamp previews use authenticated byte routes. */
import { StampArt } from '@/src/components/stamps/StampArt';
import { countryLabel, isCountryCode } from '@/src/domain/geo';
import { readAdminResponse } from './read-response';
import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { decodeAdminStamps, stampAdminPath, STAMP_INKS, type AdminStampVersion } from './stamp-contract';
import { usePendingUpload } from './use-pending-upload';
import { UUID } from './shop-contract';
import styles from './ShopStampAdmin.module.css';

const messages:Record<string,string>={
  stamp_limit:'This shop has reached the limit of 50 retained stamp versions.',
  upload_expired:'This upload expired. Save again to start a fresh upload.',
  upload_conflict:'This upload cannot be resumed. Save again to start a fresh upload.',
  invalid_upload:'Use a 1200 × 800 transparent PNG up to 5 MiB with supported RGB/RGBA export settings.',
  invalid_request:'Check the stamp fields and try again.',
  invalid_stamp_target:'This stamp draft changed or no longer accepts that file. Reload stamps.',
  revision_conflict:'This stamp changed in another session. Reload before activating.',
  stamp_conflict:'This stamp already has different artwork attached.',
  forbidden:'Only an admin can activate stamp artwork.',
  authentication_required:'Sign in again to continue.',
  service_unavailable:'Stamp administration is unavailable. Try again.',
};
class Failure extends Error { constructor(readonly code:string){super(messages[code]??'The stamp operation failed. Reload before retrying.');} }
async function call(path:string,signal:AbortSignal,options:RequestInit={}) {
  const r=await fetch(path,{...options,signal,cache:'no-store',credentials:'same-origin'});
  const value=await readAdminResponse(r, !!options.method && options.method !== 'GET');
  if(!r.ok) throw new Failure(value.error?.code??'service_unavailable');
  return value;
}
const post=(value:unknown):RequestInit=>({method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(value)});

export function ShopStampAdmin({shopId,shopName,archived,localityName='',countryCode='',onPrepared}:{
  shopId:string;shopName:string;archived:boolean;localityName?:string;countryCode?:string;onPrepared?:()=>Promise<void>;
}) {
  const [entries,setEntries]=useState<AdminStampVersion[]>([]),[busy,setBusy]=useState(false),[loaded,setLoaded]=useState(false);
  const [error,setError]=useState(''),[notice,setNotice]=useState(''),[confirm,setConfirm]=useState<AdminStampVersion|null>(null);
  const controller=useRef<AbortController|null>(null),lock=useRef(false);
  const feedback = useRef<HTMLDivElement>(null);
  useEffect(() => { if (error || notice) { feedback.current?.focus(); feedback.current?.scrollIntoView({block:'center'}); } }, [error, notice]);
  const path=stampAdminPath(shopId);
  useEffect(()=>{
    const c=new AbortController();controller.current=c;
    call(path,c.signal).then(v=>{setEntries(decodeAdminStamps(v.entries));setLoaded(true);}).catch(e=>{if(!c.signal.aborted)setError(e.message);});
    return()=>c.abort();
  },[path]);
  async function run(work:(signal:AbortSignal)=>Promise<void>) {
    if(lock.current)return;lock.current=true;setBusy(true);setError('');setNotice('');
    const signal=(controller.current ??= new AbortController()).signal;
    try{await work(signal);}catch(e){if(!signal.aborted)setError(e instanceof Error?e.message:'Stamp operation failed.');}
    finally{lock.current=false;if(!signal.aborted)setBusy(false);}
  }
  return <section className={styles.section} id="shop-stamp-artwork" tabIndex={-1} aria-label="Atlas Stamp artwork">
    <p className={styles.help}>Artwork for <strong>{shopName}</strong>. New shops receive a generated default without an image upload, so no artwork has to be commissioned or uploaded. The stamp stays private while the shop is a draft. Uploaded versions are saved privately, previewed intact, and become collectable only after an admin activates them &mdash; saving ordinary shop details never activates artwork.</p>
    <div ref={feedback} tabIndex={-1}>{error&&<p role="alert">{error}</p>}
    <p role="status" aria-live="polite">{notice||(busy?'Saving…':'')}</p></div>
    <button type="button" disabled={busy} onClick={()=>void run(async signal=>{
      setEntries(decodeAdminStamps((await call(path,signal)).entries));setLoaded(true);setConfirm(null);setNotice('Stamp versions reloaded.');
    })}>Reload stamps</button>
    {loaded && entries.length===0 && !archived ? <div>
      <p>No artwork versions are listed. Prepare a generated default for a shop that has no stamp yet. Existing stamp identities are preserved.</p>
      <button type="button" disabled={busy} onClick={()=>void run(async signal=>{
        const rows=decodeAdminStamps((await call(path,signal,post({action:'ensure_default'}))).entries);
        setEntries(rows);
        setNotice(rows.length ? 'Stamp versions refreshed. Existing artwork was preserved.' : 'An existing stamp identity needs review; no artwork was replaced.');
        await onPrepared?.();
      })}>Prepare generated default</button>
    </div>:null}
    <CreateStamp disabled={busy||archived||!loaded} run={run} path={path} saved={rows=>{setEntries(rows);setNotice('Draft stamp version created. Add its PNG below.');}} />
    <div className={styles.versions}>
      {entries.map(entry=><article className={styles.version} key={entry.id}>
        <header><strong>Design v{entry.designVersion}</strong><span>{entry.active?'active':entry.status}</span></header>
        <p>{entry.kind==='generated_template'?'Generated default':entry.origin.replaceAll('_',' ')}</p>
        {entry.creatorName?<p>created by: {entry.creatorUrl&&validCreatorCredit(entry.creatorName,entry.creatorUrl)?<a href={entry.creatorUrl} target="_blank" rel="noreferrer">{entry.creatorName}</a>:entry.creatorName}</p>:null}
        {entry.kind==='generated_template'&&entry.templateData?<div className={styles.generatedPreview}>
          <StampArt title={shopName} stamp={{id:entry.stampId,tier:'shop',motif:entry.templateData.motif,
            ink:entry.ink,designVersion:entry.designVersion,paletteVersion:1,
            localityLabel:localityName,countryLabel:isCountryCode(countryCode)?countryLabel(countryCode):''}} />
          <p className={styles.help}>Generated default · no upload or creator credit needed. Name and place labels use the saved shop details; collected impressions retain their original labels.</p>
        </div>:null}
        {entry.kind==='uploaded'&&entry.hasArtwork?<StampPreview shopId={shopId} entry={entry}/>:null}
        {entry.kind==='uploaded'&&entry.status==='draft'&&!entry.hasArtwork?
          <ArtworkPicker shopId={shopId} version={entry} disabled={busy||archived} run={run} attached={rows=>{setEntries(rows);setNotice('Stamp PNG attached privately. Review all three sizes before activation.');}}/>:null}
        {entry.kind==='uploaded'&&entry.status==='draft'&&entry.hasArtwork?<button type="button" disabled={busy||archived}
          onClick={()=>setConfirm(entry)}>Activate this design (admin)</button>:null}
      </article>)}
    </div>
    {confirm?<div className={styles.confirmation} role="alertdialog" aria-label="Confirm stamp activation">
      <p>Activate design v{confirm.designVersion}? New collectors will receive this version. Existing collected impressions stay on their original version.</p>
      <button autoFocus disabled={busy} onClick={()=>void run(async signal=>{
        const value=await call(path,signal,post({action:'activate',versionId:confirm.id,revision:confirm.revision}));
        setEntries(decodeAdminStamps(value.entries));setConfirm(null);setNotice('Stamp design activated. Historical versions and impressions were preserved.');
        await onPrepared?.();
      })}>Confirm activation</button>
      <button disabled={busy} onClick={()=>setConfirm(null)}>Cancel</button>
    </div>:null}
  </section>;
}

function CreateStamp({disabled,run,path,saved}:{disabled:boolean;run:(w:(s:AbortSignal)=>Promise<void>)=>void;path:string;saved:(r:AdminStampVersion[])=>void}) {
  return <details className={styles.create}><summary>Create uploaded stamp version</summary>
    <form onSubmit={(e:FormEvent<HTMLFormElement>)=>{
      e.preventDefault();const formElement=e.currentTarget;const form=new FormData(formElement);
      void run(async signal=>{
        const value=await call(path,signal,post({action:'create',origin:form.get('origin'),creatorName:form.get('creatorName'),creatorUrl:String(form.get('creatorUrl')||'')||undefined,ink:form.get('ink')}));
        saved(decodeAdminStamps(value.entries));formElement.reset();
      });
    }}><fieldset disabled={disabled}><legend>Truthful artwork attributes</legend>
      <label>Origin<select name="origin" defaultValue="founder_created"><option value="founder_created">Founder-created</option><option value="ai_assisted">AI-assisted</option><option value="commissioned">Commissioned</option></select></label>
      <label>Creator name (optional)<input name="creatorName" maxLength={300}/></label>
      <label>Creator link (optional)<input name="creatorUrl" type="url" maxLength={2000} placeholder="https://…"/></label>
      <label>Ink<select name="ink" defaultValue="teal">{STAMP_INKS.map(ink=><option key={ink} value={ink}>{ink}</option>)}</select></label>
      <p className={styles.help}>Choose the origin and optional credit that accurately describe this artwork. A creator link requires a name.</p>
      <button>Create private draft</button>
    </fieldset></form>
  </details>;
}

function ArtworkPicker({shopId,version,disabled,run,attached}:{shopId:string;version:AdminStampVersion;disabled:boolean;run:(w:(s:AbortSignal)=>Promise<void>)=>void;attached:(r:AdminStampVersion[])=>void}) {
  const [file,setFile]=useState<File|null>(null),[preview,setPreview]=useState('');const input=useRef<HTMLInputElement>(null),uploadId=useRef<string|null>(null);
  useEffect(()=>()=>{if(preview)URL.revokeObjectURL(preview);},[preview]);
  usePendingUpload(!!file);
  const save = (file: File) => void run(async signal => {
      try{
        if(file.type!=='image/png'||file.size<1||file.size>5*1024*1024) throw new Failure('invalid_upload');
        const bytes=await file.arrayBuffer(),base='/api/v1/admin/media/uploads';
        if(!uploadId.current){
          const sha256=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
          const manifest=await call(base,signal,post({shopId,artworkVersionId:version.id,purpose:'artwork_png',sha256,byteSize:file.size,contentType:file.type}));
          if(typeof manifest.id!=='string'||!UUID.test(manifest.id))throw new Failure('service_unavailable');uploadId.current=manifest.id;
        }
        const url=`${base}/${uploadId.current}`;
        try{await call(url,signal,{method:'POST'});}catch(e){if(!(e instanceof Failure)||e.code!=='upload_incomplete')throw e;await call(url,signal,{method:'PUT',headers:{'Content-Type':'image/png'},body:bytes});await call(url,signal,{method:'POST'});}
        const value=await call(stampAdminPath(shopId),signal,post({action:'attach',versionId:version.id,uploadId:uploadId.current}));
        attached(decodeAdminStamps(value.entries));setFile(null);setPreview('');uploadId.current=null;if(input.current)input.current.value='';
      }catch(e){if(e instanceof Failure&&['upload_expired','upload_conflict'].includes(e.code))uploadId.current=null;throw e;}

  });
  return <div className={styles.picker}><label>Stamp PNG<input ref={input} type="file" accept="image/png" disabled={disabled} onChange={e=>{
    if(preview)URL.revokeObjectURL(preview);const next=e.target.files?.[0]??null;setFile(next);setPreview(next?URL.createObjectURL(next):'');uploadId.current=null;
    if(next) save(next);
  }}/></label><p>Choosing a PNG uploads and saves it privately. Review the saved preview before activation.</p>
    {file&&preview?<><img src={preview} alt={`Selected stamp artwork for ${version.creatorName??'creator'}`}/><p>{file.name} · not saved yet</p>
    <button type="button" disabled={disabled} onClick={()=>save(file)}>Save PNG privately</button></>:null}
  </div>;
}

export function StampPreview({shopId,entry}:{shopId:string;entry:AdminStampVersion}) {
  const src=`${stampAdminPath(shopId)}/${entry.id}`;
  return <div className={styles.preview} aria-label="Stamp size previews">
    <div><span>List</span><img className={styles.list} src={src} alt="List-size stamp preview"/></div>
    <div><span>Passport</span><img className={styles.passport} src={src} alt="Passport-size stamp preview"/></div>
    <div><span>Detail</span><img className={styles.detail} src={src} alt="Detail-size stamp preview"/></div>
  </div>;
}
