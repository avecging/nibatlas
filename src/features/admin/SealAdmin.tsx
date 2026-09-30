"use client";
import {useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {useAccountSession} from '@/src/features/account/AccountSessionProvider';
import {object,sealDesign,type AdminSeal,type SealDocument} from '@/src/domain/geographic-seals';
import {STAMP_INKS} from '@/src/domain/stamp-palette';
import {StampArt} from '@/src/components/stamps/StampArt';
import {CountryField} from './CountryField';
import {countryName} from './countries';
import {decodeList,decodeOptions,decodeShop,type Options,type ShopSummary} from './shop-contract';
import styles from './ShopAdmin.module.css';
const fresh=():SealDocument=>({scope:'locality',countryCode:'SG',countryLabel:'Singapore',localityId:null,ink:'vermilion',eligibleShopIds:[]});
async function api(path:string,signal:AbortSignal,body?:unknown) {
 const response=await fetch(path,{signal,credentials:'same-origin',cache:'no-store',...(body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{})});
 if(!response.ok) throw Error(response.status===409?'This seal changed, or already exists. Reload the list before trying again.':response.status===422?'Choose published shops in the selected place and check the form.':response.status===401||response.status===403?'Sign in with an editor or admin account.':'Could not save or load seals. Please try again.');
 return object(await response.json());
}
export function SealAdmin() {
 const {session}=useAccountSession();
 return <SealEditor key={session.status==='signed-in'?session.userId:session.status}/>;
}
function SealEditor() {
 const controller=useRef<AbortController|null>(null);
 const [entries,setEntries]=useState<AdminSeal[]>([]),[cursor,setCursor]=useState<string|null>(null);
 const [options,setOptions]=useState<Options>({}),[record,setRecord]=useState<AdminSeal|null>(null),[draft,setDraft]=useState<SealDocument>(fresh);
 const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[loaded,setLoaded]=useState(false),[query,setQuery]=useState('');
 const [shops,setShops]=useState<ShopSummary[]>([]),[shopCursor,setShopCursor]=useState<string|null>(null),[names,setNames]=useState<Record<string,string>>({});
 const [dirty,setDirty]=useState(false);
 useEffect(()=>{const c=new AbortController();controller.current=c;
  void Promise.all([api('/api/v1/admin/seals',c.signal),api('/api/v1/admin/shops/options',c.signal)]).then(([r,o])=>{
   if(c.signal.aborted) return;setEntries(r.entries as AdminSeal[]);setCursor(r.nextCursor as string|null);setOptions(decodeOptions(o));setLoaded(true);
  }).catch(e=>{if(!c.signal.aborted)setMessage(e.message);});return()=>c.abort();},[]);
 useEffect(()=>{
  if(!record?.draft.eligibleShopIds.length) return;
  const c=new AbortController();
  void Promise.all(record.draft.eligibleShopIds.map(async id=>{
   const r=decodeShop(await api(`/api/v1/admin/shops/${id}`,c.signal));
   return [id,String(r.document.shop.name)] as const;
  })).then(items=>{if(!c.signal.aborted)setNames(old=>({...old,...Object.fromEntries(items)}));}).catch(()=>{if(!c.signal.aborted)setMessage('Eligible shop names could not load. Reload before publishing.');});
  return()=>c.abort();
 },[record]);
 const change=(next:SealDocument)=>{setDraft(next);setDirty(true);setMessage('');};
 async function reload(after:string|null=null) {if(!controller.current)return;setBusy(true);try{const r=await api(`/api/v1/admin/seals${after?`?after=${after}`:''}`,controller.current.signal);setEntries(old=>after?[...old,...r.entries as AdminSeal[]]:r.entries as AdminSeal[]);setCursor(r.nextCursor as string|null);setMessage('');}catch(e){setMessage((e as Error).message);}finally{setBusy(false);}}
 async function action(kind:'save'|'publish'|'unpublish') {
  if(!controller.current)return;setBusy(true);setMessage('');
  try{const r=await api('/api/v1/admin/seals',controller.current.signal,{action:kind,id:record?.id??null,revision:record?.revision??null,...(kind==='save'?{document:draft}:{})});
   const saved=r.seal as AdminSeal;setRecord(saved);setDraft(saved.draft);setDirty(false);setEntries(old=>[...old.filter(e=>e.id!==saved.id),saved]);setMessage(kind==='save'?'Saved privately. Publish when ready.':kind==='publish'?'Published. Past verified visits count too.':'Unpublished. Existing collectors keep their seals.');
  }catch(e){setMessage((e as Error).message);}finally{setBusy(false);}
 }
 async function search(after:string|null=null) {if(!controller.current)return;setBusy(true);try {const r=await api(`/api/v1/admin/shops?q=${encodeURIComponent(query)}${after?`&after=${after}`:''}`,controller.current.signal);setShops(old=>after?[...old,...decodeList(r.entries)]:decodeList(r.entries));setShopCursor(r.nextCursor as string|null);}catch(e){setMessage((e as Error).message);}finally{setBusy(false);}}
 const locality=options.localities?.find(l=>l.id===draft.localityId)?.label??record?.localityName??'';
 return <div className={styles.admin}>
  <nav aria-label="Administration"><Link href="/admin/shops">Shops</Link> · Stamps &amp; seals</nav>
  <h1>Stamps &amp; seals</h1><p>Manage shop artwork in Shops. Geographic seals are earned from verified shop visits.</p>
  <p role="status">{message}</p>
  {loaded?<>
   <section aria-label="Saved seals"><h2>Geographic seals</h2>
    <button disabled={busy||dirty} onClick={()=>{setRecord(null);setDraft(fresh());setMessage('');}}>New seal</button>{' '}
    <button disabled={busy||dirty} onClick={()=>void reload()}>Reload list</button>
    <ul>{entries.map(e=><li key={e.id}><button disabled={busy||dirty} onClick={()=>{setRecord(e);setDraft(e.draft);setDirty(false);setMessage('');}}>{e.localityName??e.draft.countryLabel} · {e.draft.scope} · {e.published?'Published':'Private'}</button></li>)}</ul>
    {cursor?<button disabled={busy||dirty} onClick={()=>void reload(cursor)}>More seals</button>:null}
   </section>
   <form onSubmit={e=>{e.preventDefault();void action('save');}}><fieldset disabled={busy}><legend>{record?'Edit seal':'New geographic seal'}</legend>
    <label htmlFor="seal-scope">Scope</label><select id="seal-scope" value={draft.scope} disabled={!!record} onChange={e=>change({...draft,scope:e.target.value as SealDocument['scope'],localityId:null,eligibleShopIds:[]})}><option value="locality">Locality</option><option value="country">Country</option></select>
    <CountryField value={draft.countryCode} disabled={!!record} onChange={code=>{if(code)change({...draft,countryCode:code as SealDocument['countryCode'],countryLabel:countryName(code),localityId:null,eligibleShopIds:[]});}}/>
    {draft.scope==='locality'?<div><label htmlFor="seal-locality">Locality</label><select id="seal-locality" required disabled={!!record} value={draft.localityId??''} onChange={e=>change({...draft,localityId:e.target.value,eligibleShopIds:[]})}><option value="">Choose locality</option>{options.localities?.filter(l=>l.countryCode===draft.countryCode).map(l=><option key={l.id} value={l.id}>{l.label}</option>)}</select></div>:null}
    <label htmlFor="seal-ink">Ink</label><select id="seal-ink" value={draft.ink} onChange={e=>change({...draft,ink:e.target.value as SealDocument['ink']})}>{STAMP_INKS.map(ink=><option key={ink}>{ink}</option>)}</select>
    <div style={{maxWidth:420,margin:'1rem auto'}}><StampArt stamp={sealDesign(record?.id??'preview',draft,1,locality)} title={draft.scope==='country'?draft.countryLabel:locality||'Locality'}/></div>
    <p>Earn after {draft.scope==='locality'?2:5} distinct shop stamps. Optionally establish {draft.scope==='locality'?'a sole eligible shop':'a complete eligible set of 1–4 shops'}. This is an editorial decision, not the current catalogue size.</p>
    <ul>{draft.eligibleShopIds.map(id=><li key={id}>{names[id]??`Loading shop ${id.slice(-6)}…`} <button type="button" onClick={()=>change({...draft,eligibleShopIds:draft.eligibleShopIds.filter(v=>v!==id)})}>Remove</button></li>)}</ul>
    {draft.eligibleShopIds.length<(draft.scope==='locality'?1:4)?<><label>Find eligible shop<input value={query} onChange={e=>setQuery(e.target.value)}/></label><button type="button" onClick={()=>void search()}>Search shops</button>
     <ul>{shops.filter(s=>s.publicationStatus==='published'&&!draft.eligibleShopIds.includes(s.id)).map(s=><li key={s.id}><button type="button" onClick={()=>{setNames(old=>({...old,[s.id]:s.name}));change({...draft,eligibleShopIds:[...draft.eligibleShopIds,s.id]});}}>{s.name}</button></li>)}</ul>{shopCursor?<button type="button" onClick={()=>void search(shopCursor)}>More shops</button>:null}</>:null}
    <p>Save keeps changes private. Publish affects future awards; existing collectors retain their original seal.</p>
    <button type="submit" disabled={draft.scope==='locality'&&!draft.localityId}>Save privately</button>{' '}
    <button type="button" disabled={!record||dirty||draft.eligibleShopIds.some(id=>!names[id])} onClick={()=>void action('publish')}>Publish saved seal</button>{' '}
    <button type="button" disabled={!record?.published||dirty} onClick={()=>void action('unpublish')}>Unpublish</button>{' '}
    {dirty?<button type="button" onClick={()=>{setDraft(record?.draft??fresh());setDirty(false);setMessage('Unsaved changes discarded.');}}>Discard unsaved changes</button>:null}
   </fieldset></form>
  </>:null}
 </div>;
}
