'use client';
import {useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {useAccountSession} from '@/src/features/account/AccountSessionProvider';
import {sealDesign,type AdminSeal,type SealDocument,type SealSnapshot} from '@/src/domain/geographic-seals';
import {STAMP_INKS} from '@/src/domain/stamp-palette';
import {StampArt} from '@/src/components/stamps/StampArt';
import {CountryField} from './CountryField';
import {countryName} from './countries';
import {decodeOptions,type Options} from './shop-contract';
import {UploadField} from './UploadField';
import {sealApi} from './seal-client';
import base from './ShopAdmin.module.css';
import styles from './SealAdmin.module.css';
const fresh=():SealDocument=>({scope:'country',countryCode:'SG',countryLabel:'Singapore',localityId:null,ink:'teal',eligibleShopIds:[],name:'Singapore',origin:'generated',artworkId:null,artworkTreatment:'ink-v1'});
const origins={generated:'Generated default',founder_created:'Founder-created',ai_assisted:'AI-assisted',commissioned:'Commissioned'};
export function SealEditor({id}:{id?:string}){const {session}=useAccountSession();return <Editor key={`${session.status==='signed-in'?session.userId:session.status}:${id??'new'}`} id={id}/>;}
function Editor({id}:{id?:string|undefined}){
 const router=useRouter(),controller=useRef<AbortController|null>(null),lock=useRef(false);
 const [record,setRecord]=useState<AdminSeal|null>(null),[draft,setDraft]=useState<SealDocument>(fresh),[options,setOptions]=useState<Options>({});
 const [busy,setBusy]=useState(true),[loaded,setLoaded]=useState(false),[dirty,setDirty]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState(''),[tab,setTab]=useState<'design'|'history'>('design');
 const [versions,setVersions]=useState<{version:number;snapshot:SealSnapshot}[]>([]),[before,setBefore]=useState<number|null>(null),[historyLoaded,setHistoryLoaded]=useState(false);
 const [file,setFile]=useState<File|null>(null),[reload,setReload]=useState(0);
 useEffect(()=>{const c=new AbortController();controller.current=c;
  void Promise.all([sealApi('/api/v1/admin/shops/options',c.signal),id?sealApi(`/api/v1/admin/seals?id=${id}`,c.signal):Promise.resolve(null)]).then(([o,r])=>{if(c.signal.aborted)return;setOptions(decodeOptions(o));if(r){const s=r.seal as AdminSeal;setRecord(s);setDraft(s.draft.artworkId?{...s.draft,artworkTreatment:'ink-v1'}:s.draft);if(s.draft.artworkId&&!s.draft.artworkTreatment)setMessage('Save privately to use the selected ink for SVG artwork.');}setLoaded(true);setDirty(!!r&&(r.seal as AdminSeal).draft.artworkId!=null&&(r.seal as AdminSeal).draft.artworkTreatment!=='ink-v1');setFile(null);}).catch(e=>{if(!c.signal.aborted)setError(e.message);}).finally(()=>{if(!c.signal.aborted)setBusy(false);});return()=>c.abort();
 },[id,reload]);
 useEffect(()=>{if(!dirty&&!file)return;const warn=(e:BeforeUnloadEvent)=>{e.preventDefault();};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn);},[dirty,file]);
 const locality=options.localities?.find(l=>l.id===draft.localityId)?.label??record?.localityName??'';
 const title=draft.name||locality||draft.countryLabel;
 function change(p:Partial<SealDocument>){setDraft(d=>({...d,...p,artworkTreatment:'ink-v1'}));setDirty(true);setMessage('');}
 async function run(work:(signal:AbortSignal)=>Promise<void>){if(lock.current||!controller.current)return;lock.current=true;setBusy(true);setError('');setMessage('');const signal=controller.current.signal;try{await work(signal);}catch(e){if(!signal.aborted)setError(e instanceof Error?e.message:'Could not save this seal.');}finally{lock.current=false;if(!signal.aborted)setBusy(false);}}
 function accept(s:AdminSeal){setRecord(s);setDraft(s.draft);setDirty(false);setHistoryLoaded(false);}
 async function save(signal:AbortSignal){
  let s=(await sealApi('/api/v1/admin/seals',signal,{action:'save',id:record?.id??null,revision:record?.revision??null,document:{...draft,artworkTreatment:'ink-v1',eligibleShopIds:[]}})).seal as AdminSeal;
  accept(s);
  if(file){
   const r=await fetch(`/api/v1/admin/seals/${s.id}/artwork`,{method:'POST',signal,credentials:'same-origin',headers:{'Content-Type':file.name.toLowerCase().endsWith('.svg')?'image/svg+xml':'image/png'},body:file});
   if(!r.ok){
    const failure=await r.json().catch(()=>null);
    if(r.status===422&&failure?.error==='jpeg_artwork_not_supported')throw Error('This file contains a JPEG image, even though its name ends in .png. Export it as a PNG in your image editor; renaming it is not enough. Your seal details were saved. Choose the exported PNG and save again.');
    throw Error(r.status===422?'Unsupported artwork. Use PNG or a self-contained SVG without scripts, external references or embedded images. Your seal details were saved; choose another file or retry.':'Artwork could not be saved. Your seal details are saved; retry this upload.');
   }
   const asset=await r.json();
   s=(await sealApi('/api/v1/admin/seals',signal,{action:'save',id:s.id,revision:s.revision,document:{...s.draft,artworkId:asset.id}})).seal as AdminSeal;
   accept(s);setFile(null);
  }
  setMessage('Saved privately. Publish when ready.');
  if(!id){router.replace(`/admin/seals/${s.id}`);}
 }
 async function history(signal:AbortSignal,older:number|null=null){if(!record)return;const r=await sealApi(`/api/v1/admin/seals?id=${record.id}&history=1${older?`&before=${older}`:''}`,signal);setVersions(v=>older?[...v,...r.entries as typeof versions]:r.entries as typeof versions);setBefore(r.nextBefore as number|null);setHistoryLoaded(true);}
 function leave(e:React.MouseEvent<HTMLAnchorElement>){if((dirty||file)&&!window.confirm('Leave without saving these changes?'))e.preventDefault();}
 return <div className={base.admin}><nav aria-label="Seal navigation"><Link href="/admin/seals" onClick={leave}>← All stamps &amp; seals</Link></nav>
  <header className={styles.header}><div><div className={styles.scopeHeading}>{draft.scope==='country'?'Country seal':'Locality seal'}</div><h1>{record?title:'Add new seal'}</h1><p>{record?`${record.published?'Published':'Private'} · ${record.publishedVersion?`Artwork v${record.publishedVersion}`:'No published version'}`:'Choose the place and design, then save privately.'}</p></div></header>
  {error?<p role="alert">{error} {!loaded?<button onClick={()=>{setBusy(true);setError('');setReload(v=>v+1);}}>Retry loading</button>:null}</p>:null}<p role="status">{message||(busy?'Working…':'')}</p>
  <div className={styles.tabs} role="tablist" aria-label="Seal editor"><button role="tab" id="design-tab" aria-selected={tab==='design'} aria-controls="design-panel" onClick={()=>setTab('design')}>Design &amp; details</button><button role="tab" id="history-tab" aria-selected={tab==='history'} aria-controls="history-panel" disabled={!record||busy} onClick={()=>{setTab('history');if(!historyLoaded)void run(s=>history(s));}}>Version history</button></div>
  {loaded&&tab==='design'?<div id="design-panel" role="tabpanel" aria-labelledby="design-tab"><form onSubmit={e=>{e.preventDefault();void run(save);}}>
   <div className={styles.editor}><div className={styles.fields}><fieldset disabled={busy}><legend>Seal details</legend><div className={styles.fields}>
    <label>Name<input required maxLength={100} value={draft.name??title} onChange={e=>change({name:e.target.value})}/></label>
    <label>Scope<select value={draft.scope} disabled={!!record} onChange={e=>change({scope:e.target.value as SealDocument['scope'],localityId:null})}><option value="country">Country</option><option value="locality">Locality</option></select></label>
    <CountryField value={draft.countryCode} disabled={!!record} onChange={code=>{if(code)change({countryCode:code as SealDocument['countryCode'],countryLabel:countryName(code),localityId:null,name:countryName(code)});}}/>
    {draft.scope==='locality'?<label>Locality<select required disabled={!!record} value={draft.localityId??''} onChange={e=>change({localityId:e.target.value,name:options.localities?.find(l=>l.id===e.target.value)?.label??''})}><option value="">Choose locality</option>{options.localities?.filter(l=>l.countryCode===draft.countryCode).map(l=><option key={l.id} value={l.id}>{l.label}</option>)}</select></label>:null}
   </div></fieldset><fieldset disabled={busy}><legend>Artwork &amp; credit</legend><div className={styles.fields}>
    <label>Origin<select value={draft.origin??'generated'} onChange={e=>{const origin=e.target.value as SealDocument['origin'];change({origin,...(origin==='generated'?{artworkId:null,creatorName:undefined,creatorUrl:undefined}:{})});if(origin==='generated')setFile(null);}}>{Object.entries(origins).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
    {draft.origin&&draft.origin!=='generated'?<>
     <UploadField label="Seal artwork" accept="image/png,image/svg+xml,.png,.svg" filename={file?.name??''} disabled={busy} onSelect={f=>{if(f.size>5*1024*1024||f.size<1||!(/\.(png|svg)$/i.test(f.name))){setError('Choose a PNG or SVG up to 5 MiB.');return;}setFile(f);setDirty(true);setError('');}} onClear={()=>{setFile(null);}} help="PNG (RGB/RGBA, up to 2048 px per side and 5 MiB) or SVG (up to 512 KiB). Save privately to upload and inspect the preview. Changing Ink updates saved SVG previews immediately. SVG artwork uses the selected ink, preserving transparent areas. PNG artwork keeps its original colours. Original files and previously collected versions are retained."/>
     <label>Creator name (optional)<input value={draft.creatorName??''} maxLength={300} onChange={e=>change({creatorName:e.target.value||undefined})}/></label>
     <label>Creator link (optional)<input type="url" value={draft.creatorUrl??''} maxLength={2000} onChange={e=>change({creatorUrl:e.target.value||undefined})}/></label>
     <p className={styles.notice}>A creator link needs a creator name.</p>
    </>:null}
    <label>Ink<select value={draft.ink} onChange={e=>change({ink:e.target.value as SealDocument['ink']})}>{STAMP_INKS.map(ink=><option key={ink}>{ink}</option>)}</select></label>
   </div></fieldset></div>
   <aside className={styles.preview} aria-label="Seal preview"><h2>{draft.scope==='country'?'Country seal':'Locality seal'}</h2><p>{draft.countryLabel}{draft.scope==='locality'?` / ${locality||'Choose locality'}`:''}</p>
    {draft.origin&&draft.origin!=='generated'&&!draft.artworkId?<p>Choose artwork and save to see its preview.</p>:<StampArt stamp={sealDesign(record?.id??'preview',draft,record?.publishedVersion??1,locality)} title={title}/>}
    {file?<p>New file selected: {file.name}. Save to update this preview.</p>:null}
    <h3>How it is earned</h3><p>Shops are included automatically from their published {draft.scope==='locality'?'locality and country':'country'}.</p><p>Visit {draft.scope==='locality'?2:5} different shops, or every eligible shop if there are fewer. Existing collected seals remain yours when shops move or the catalogue changes.</p>
   </aside></div>
   <div className={styles.actions}><button className={base.primary} disabled={busy}>Save privately</button><button type="button" disabled={busy||!record||dirty||!!file} onClick={()=>void run(async signal=>{accept((await sealApi('/api/v1/admin/seals',signal,{action:'publish',id:record!.id,revision:record!.revision})).seal as AdminSeal);setMessage('Published. Past verified visits count too.');})}>Publish saved seal</button><button type="button" disabled={busy||!record?.published||dirty||!!file} onClick={()=>void run(async signal=>{accept((await sealApi('/api/v1/admin/seals',signal,{action:'unpublish',id:record!.id,revision:record!.revision})).seal as AdminSeal);setMessage('Unpublished. Existing collectors keep their seals.');})}>Unpublish</button>{dirty||file?<button type="button" disabled={busy} onClick={()=>{setDraft(record?.draft??fresh());setFile(null);setDirty(false);setMessage('');}}>Discard unsaved changes</button>:null}</div>
  </form></div>:null}
  {tab==='history'?<section id="history-panel" role="tabpanel" aria-labelledby="history-tab"><p>Published versions are kept intact. Saving edits does not replace an earlier design or an earned seal.</p><div className={styles.history}>
   {historyLoaded&&!versions.length?<p>No published versions yet.</p>:null}
   {versions.map(v=><article className={styles.version} key={v.version}><StampArt stamp={sealDesign(record!.id,v.snapshot,v.version,v.snapshot.localityName??'')} title={v.snapshot.name||v.snapshot.localityName||v.snapshot.countryLabel}/><div><h2>Version {v.version}{record?.published&&record.publishedVersion===v.version?' · Current':''}</h2><dl><dt>Name</dt><dd>{v.snapshot.name||v.snapshot.localityName||v.snapshot.countryLabel}</dd><dt>Scope</dt><dd>{v.snapshot.scope==='country'?'Country':'Locality'}</dd><dt>Origin</dt><dd>{origins[v.snapshot.origin??'generated']}</dd><dt>Creator name</dt><dd>{v.snapshot.creatorName||'Not supplied'}</dd><dt>Creator link</dt><dd>{v.snapshot.creatorUrl?<a href={v.snapshot.creatorUrl} target="_blank" rel="noreferrer">{v.snapshot.creatorUrl}</a>:'Not supplied'}</dd><dt>Ink</dt><dd>{v.snapshot.ink}</dd></dl></div></article>)}
  </div>{before?<button disabled={busy} onClick={()=>void run(s=>history(s,before))}>Older versions</button>:null}</section>:null}
 </div>;
}
