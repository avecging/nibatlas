"use client";
import {useCollection} from '@/src/features/collection/collection-store';
import styles from './GeographicSealProgress.module.css';
export function GeographicSealProgress() {
 const store=useCollection();if(store.source!=='account') return null;
 const rows=store.geographicSeals??[], unseen=rows.flatMap(r=>r.award?.unseen?[r.award]:[]);
 if(store.sealReadStatus==='error') return <p role="status">Seals could not refresh. Your shop stamps are still available. <button onClick={store.retryRead}>Try again</button></p>;
 if(!rows.length) return null;
 return <details className={styles.panel}><summary>Geographic seals{unseen.length?` · ${unseen.length} new`:''}</summary>
  <div className={styles.content}>
  {unseen.length>0?<section aria-label="New seals from your past visits"><h2>New seals from your past visits</h2><p>{unseen.map(a=>`${a.localityName??a.countryLabel} (${a.scope})`).join(' · ')}</p><button onClick={()=>store.acknowledgeSeals?.(unseen.map(a=>a.awardId))}>Got it</button></section>:null}
  {rows.map(row=>{const s=row.current,p=row.progress;if(!s||!p) return null;const threshold=s.scope==='locality'?2:5;
   return <section key={row.id}><h3>{s.localityName??s.countryLabel} · {s.scope} seal</h3>
    <p>{row.award?'Seal earned.':`${Math.min(p.count,threshold)} of ${threshold} distinct shop stamps.`}</p>
    <p>Earn this seal with verified visits to {threshold} different shops{s.eligibleShops.length?' or every shop in this eligible set':''}.</p>
    {s.eligibleShops.length?<ul>{s.eligibleShops.map(shop=><li key={shop.id}>{p.collectedIds.includes(shop.id)?'Collected':'To collect'} · {shop.name}</li>)}</ul>:null}
   </section>;
  })}</div>
 </details>;
}
