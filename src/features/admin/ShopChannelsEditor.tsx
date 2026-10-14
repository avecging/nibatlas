'use client';
import { useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { SOCIAL_PLATFORMS, CONTACT_PLATFORMS, PLATFORM_NAMES, PLATFORM_HINTS, isContactPlatform, type Platform } from '@/src/domain/shop-channels';
import { PlatformIcon } from '@/src/components/ui/PlatformIcon';
import type { Row } from './shop-contract';
import type { FieldIssue } from './shop-normalization';
import { useDialog } from './use-dialog';
import styles from './ShopChannelsEditor.module.css';

function Picker({platforms, used, title, close, add}: {platforms:readonly Platform[]; used:Set<unknown>;title:string;close:()=>void;add:(p:Platform[])=>void}) {
  const [selected,setSelected] = useState<Platform[]>([]), ref = useRef<HTMLDivElement>(null), id = useId();
  useDialog(ref, close);
  return createPortal(<div className={styles.backdrop}><div ref={ref} role="dialog" aria-modal="true" aria-labelledby={id} className={styles.dialog}>
    <h2 id={id}>Add {title}</h2>
    <div className={styles.choices}>{platforms.map(p => <label key={p} className={styles.choice}>
      <input type="checkbox" checked={selected.includes(p)} disabled={used.has(p)} onChange={e=>setSelected(prev=>e.target.checked?[...prev,p]:prev.filter(v=>v!==p))}/>
      <PlatformIcon platform={p}/><span>{PLATFORM_NAMES[p]}{used.has(p) ? ' · added' : ''}</span>
    </label>)}</div>
    <div className={styles.actions}><button type="button" onClick={close} autoFocus>Cancel</button><button type="button" className={styles.primary} disabled={!selected.length} onClick={()=>add(selected)}>Add</button></div>
  </div></div>, document.body);
}
export function ShopChannelsEditor({links, change, errors}: {links:Row[];change:(v:Row[])=>void;errors:FieldIssue[]}) {
  const [picker,setPicker] = useState<'social'|'contact'|null>(null);
  const groups = [{key:'social' as const,title:'Social Media',platforms:SOCIAL_PLATFORMS},{key:'contact' as const,title:'Contact',platforms:CONTACT_PLATFORMS}];
  const group = groups.find(g=>g.key===picker);
  return <div className={styles.columns}>
    {groups.map(g=><section key={g.key} aria-label={g.title}>
      <div className={styles.heading}><h3>{g.title}</h3><button type="button" onClick={()=>setPicker(g.key)} aria-label={`Add ${g.title}`}>Add</button></div>
      {links.map((row,index)=>{
        const p=row.link_type as Platform;
        if (!(g.platforms as readonly string[]).includes(p)) return null;
        const path=`links.${index}.url`, error=errors.find(e=>e.path===path || e.path===`links.${index}.account_value`);
        return <div className={styles.entry} key={String(row.id)}>
          <label><span className={styles.label}><PlatformIcon platform={p} size={20}/>{PLATFORM_NAMES[p]}</span>
            <input data-field-path={path} value={String(row.url ?? row.account_value ?? '')} aria-invalid={!!error} aria-describedby={`${row.id}-hint${error ? ` ${row.id}-error` : ''}`} onChange={e=>change(links.map((r,i)=>i===index?{...r,url:isContactPlatform(p)?null:e.target.value,account_value:isContactPlatform(p)?e.target.value:null}:r))}/>
          </label>
          <button type="button" aria-label={`Remove ${PLATFORM_NAMES[p]}`} onClick={()=>change(links.filter((_,i)=>i!==index))}>Remove</button>
          <small id={`${row.id}-hint`}>{PLATFORM_HINTS[p]}</small>
          {error && <p id={`${row.id}-error`} role="alert">{error.message}</p>}
        </div>;
      })}
    </section>)}
    {group && <Picker platforms={group.platforms} used={new Set(links.map(r=>r.link_type))} title={group.title} close={()=>setPicker(null)} add={selected=>{
      change([...links,...selected.map(p=>({id:crypto.randomUUID(),link_type:p,url:null,account_value:null,label:null,is_official:true,sort_order:links.length+selected.indexOf(p)}))]);setPicker(null);
    }}/>}
  </div>;
}
