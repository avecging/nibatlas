'use client';
import { useEffect, useRef, useState } from 'react';
import { contactAction, isContactPlatform, isPlatform, PLATFORM_NAMES, webUrl, type ContactAction } from '@/src/domain/shop-channels';
import { PlatformIcon } from '@/src/components/ui/PlatformIcon';
import { Icon } from '@/src/components/ui/Icon';
import type { ShopLink } from '@/src/domain/shop-detail';
import styles from './ShopChannels.module.css';
import detailStyles from './ShopDetailView.module.css';

/** Device hint only; never claims to detect app installation or failed launches. */
export function mobileMessagingDevice(): boolean {
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
}
export function ShopMessaging({links, inert=false}: {links:readonly ShopLink[];inert?:boolean}) {
  const [status,setStatus] = useState(''), [fallback,setFallback] = useState<string|null>(null), timer=useRef<ReturnType<typeof setTimeout>|null>(null);
  useEffect(()=>()=>{if(timer.current) clearTimeout(timer.current);},[]);
  const contacts = links.flatMap(link=>{
    if (!link.isOfficial || !isContactPlatform(link.type)) return [];
    try { return [{platform:link.type,action:contactAction(link.type,link.url ?? link.accountValue ?? '')}]; } catch { return []; }
  }).filter(c=>c.action.copy);
  if (!contacts.length) return null;
  async function copy(action:ContactAction) {
    if(timer.current) clearTimeout(timer.current);
    setFallback(null);
    try { await navigator.clipboard.writeText(action.copy); setStatus(`${action.kind} copied`); timer.current=setTimeout(()=>setStatus(''),2500); }
    catch { setStatus('Could not copy. Select and copy this value:'); setFallback(action.copy); }
  }
  return <div className={styles.messaging} aria-label="Messaging contacts">
    <div className={styles.icons}>{contacts.map(({platform,action},i)=><button key={`${platform}-${i}`} type="button" disabled={inert} title={PLATFORM_NAMES[platform]} aria-label={PLATFORM_NAMES[platform]} onClick={()=>{
      if(mobileMessagingDevice() && action.href) window.location.assign(action.href);
      else void copy(action);
    }}><PlatformIcon platform={platform} size={30}/></button>)}</div>
    <span role="status" className={styles.status}>{status}</span>
    {fallback && <input aria-label="Contact to copy" readOnly value={fallback} onFocus={e=>e.currentTarget.select()}/>}
  </div>;
}
export function ShopWebsiteSocial({links}: {links:readonly ShopLink[]}) {
  const rows = links.filter((link):link is ShopLink & {url:string}=>!!link.url && !!webUrl(link.url) && !isContactPlatform(link.type))
    .sort((a,b)=>Number(isPlatform(a.type))-Number(isPlatform(b.type)));
  if (!rows.length) return null;
  return <section className={`${detailStyles.section} ${styles.card}`} aria-labelledby="website-social"><h2 className={detailStyles.sectionTitle} id="website-social">Website &amp; social</h2>
    <ul>{rows.map((link,i)=><li key={`${link.url}-${i}`}>
      {isPlatform(link.type) ? <PlatformIcon platform={link.type} size={22}/> : <Icon name="globe" size={22}/>}
      <a href={link.url} target="_blank" rel="noreferrer noopener" aria-label={`${isPlatform(link.type) ? PLATFORM_NAMES[link.type] : link.type === 'directions' ? 'Directions' : link.type === 'contact' ? 'Contact' : link.isOfficial ? 'Website' : 'Reference'}: ${link.url}`}>{link.url}</a>
    </li>)}</ul>
  </section>;
}
