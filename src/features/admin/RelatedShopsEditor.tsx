'use client';
import { useEffect, useId, useRef, useState } from 'react';
import { decodeList, type Row, type ShopRecord, type ShopSummary } from './shop-contract';
import { readAdminResponse } from './read-response';
import type { FieldIssue } from './shop-normalization';
import styles from './RelatedShopsEditor.module.css';

/** Only advise when names have no meaningful word in common. Location suffixes
 * (LAMY Somerset / LAMY Jewel) therefore do not produce a spurious warning. */
export function branchNameAdvisory(a: string, b: string): boolean {
  const words=(s:string)=>s.toLocaleLowerCase().match(/[\p{L}\p{N}]+/gu)?.filter(w=>!['the','pte','ltd','shop','store','co'].includes(w)) ?? [];
  const left=words(a), right=words(b);
  return left.length>0 && right.length>0 && !left.some(w=>right.includes(w));
}
export function RelatedShopsEditor({id,name,rows,context,errors,change}: {
  id:string; name:string; rows:Row[]; context:ShopRecord['relatedContext']; errors:FieldIssue[]; change:(rows:Row[])=>void;
}) {
  const uid=useId(), controller=useRef<AbortController|null>(null);
  const [query,setQuery]=useState(''), [results,setResults]=useState<ShopSummary[]>([]);
  const [selected,setSelected]=useState<ShopSummary[]>([]), [pending,setPending]=useState<ShopSummary[]>([]);
  const [addKind,setAddKind]=useState<'branch'|'related'>('branch');
  const [status,setStatus]=useState(''),[busy,setBusy]=useState(false);
  const [cursor,setCursor]=useState<string|null>(null);
  useEffect(()=>()=>controller.current?.abort(),[]);
  async function search(after?:string) {
    controller.current?.abort(); const c=new AbortController(); controller.current=c;
    setBusy(true);setStatus('');
    try {
      const response=await fetch(`/api/v1/admin/shops?q=${encodeURIComponent(query.trim())}${after?`&after=${encodeURIComponent(after)}`:''}`,{signal:c.signal,credentials:'same-origin',cache:'no-store'});
      const body=await readAdminResponse(response);
      if(!response.ok) throw Error('Search unavailable');
      const entries=decodeList(body.entries);
      if(c.signal.aborted) return;
      setResults(old=>after?[...old,...entries]:entries);setCursor(body.nextCursor ?? null);
      if(!entries.length) setStatus('No shops found. Try another name.');
    } catch { if(!c.signal.aborted) {setResults([]);setCursor(null);setStatus('Shop search could not load. Try again.');} }
    finally {if(!c.signal.aborted) setBusy(false);}
  }
  const update=(shopId:string,patch:Row)=>change(rows.map(r=>r.shop_id===shopId?{...r,...patch}:r));
  return <section className={styles.panel} aria-labelledby={`${uid}-title`} data-field-path="related_shops">
    <h3 id={`${uid}-title`}>Related shops</h3>
    <p>Connect branches or sister shops. Select several search results, then add them together. Save keeps changes private; publish using the usual flow. The other shop gets a private backlink. Public links appear here instead of Nearby.</p>
    <div className={styles.search}>
      <label htmlFor={`${uid}-search`}>Find an existing shop</label>
      <input id={`${uid}-search`} value={query} maxLength={120} onChange={e=>{controller.current?.abort();setBusy(false);setQuery(e.target.value);setResults([]);setCursor(null);setStatus('');}}
        onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();void search();}}}/>
      <button type="button" disabled={busy} onClick={()=>void search()}>Search shops</button>
    </div>
    <p role="status">{busy?'Searching…':status}</p>
    {!!results.length && <ul className={styles.results}>{results.filter(s=>s.id!==id && s.publicationStatus!=='archived' && !rows.some(r=>r.shop_id===s.id)).map(s=><li key={s.id}>
      <label><input type="checkbox" checked={pending.some(item=>item.id===s.id)} disabled={rows.length+pending.length>=100 && !pending.some(item=>item.id===s.id)}
        onChange={e=>setPending(old=>e.target.checked?[...old,s]:old.filter(item=>item.id!==s.id))}/>
        <span>{s.name} <small>/{s.slug} · {s.publicationStatus}</small></span></label>
    </li>)}</ul>}
    {!!pending.length && <div className={styles.addSelected}>
      <label>Relationship for selected shops <select value={addKind} onChange={e=>setAddKind(e.target.value as 'branch'|'related')}>
        <option value="branch">Branch</option><option value="related">Related shop</option>
      </select></label>
      <button type="button" onClick={()=>{
        const additions=pending.filter(s=>s.id!==id && !rows.some(r=>r.shop_id===s.id)).slice(0,100-rows.length);
        change([...rows,...additions.map(s=>({shop_id:s.id,kind:addKind,show_public:false}))]);
        setSelected(old=>[...old,...additions]);setPending([]);
      }}>Add selected ({pending.length})</button>
    </div>}
    {cursor && <button type="button" disabled={busy} onClick={()=>void search(cursor)}>More results</button>}
    {rows.map((row,index)=>{
      const target=String(row.shop_id),shop=context?.shops.find(s=>s.id===target) ?? selected.find(s=>s.id===target);
      return <div key={target} className={styles.row} data-field-path={`related_shops.${index}`}>
        <strong>{shop?.name ?? 'Related shop'}{!shop && <small> · {target}</small>}</strong>
        <label>Relationship label
          <select value={String(row.kind)} onChange={e=>update(target,{kind:e.target.value})}>
            <option value="branch">Branch</option><option value="related">Related shop</option>
          </select>
        </label>
        <small>This label is shared by both shops.</small>
        {row.kind==='branch' && shop && branchNameAdvisory(name,shop.name) && <p className={styles.note}>The names look different. Check that these are branches of the same business; you can keep this label if correct.</p>}
        <div className={styles.visibility}>
          <label><input type="checkbox" checked={row.show_public===true} disabled={!context} onChange={e=>update(target,{show_public:e.target.checked})}/> Show on this shop’s public page</label>
        </div>
        {!context && <p>Reload the saved shop before enabling public display.</p>}
        {shop?.publicationStatus!=='published' && <small>Only published shops appear to visitors.</small>}
        <div><button type="button" onClick={()=>change(rows.filter(r=>r.shop_id!==target))}>Remove</button><small> Removes the link from both shops when saved, and from public pages when published. To hide only this side, turn public display off.</small></div>
      </div>;
    })}
    {errors.filter(e=>e.path.startsWith('related_shops')).map(e=><p key={e.path} role="alert">{e.message}</p>)}
  </section>;
}
