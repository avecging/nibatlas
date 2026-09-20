'use client';
/* eslint-disable @next/next/no-img-element -- Same-origin publication-checked delivery, no persistent image proxy. */
import { useEffect, useState } from 'react';
import { decodeShopMedia, mediaPath, type ShopMedia } from '@/src/features/admin/media-contract';
import { UUID } from '@/src/features/admin/shop-contract';
import styles from './ShopMediaGallery.module.css';
export function ShopMediaGallery({shopId}: {shopId:string}) {
  const [entries,setEntries] = useState<ShopMedia[]>([]);
  const [failed,setFailed] = useState(false), [attempt,setAttempt] = useState(0);
  useEffect(() => {
    if (!UUID.test(shopId)) return;
    const c = new AbortController();
    fetch(mediaPath(shopId,false),{signal:c.signal,cache:'no-store'}).then(async r => {
      if (!r.ok) throw Error();
      setEntries(decodeShopMedia((await r.json()).entries));setFailed(false);
    }).catch(() => {if (!c.signal.aborted) setFailed(true);});
    return () => c.abort();
  },[shopId,attempt]);
  if (failed) return <p>Shop images could not load. <button type="button" onClick={() => setAttempt(n => n+1)}>Retry images</button></p>;
  if (!entries.length) return null;
  return <section aria-label="Shop images" className={styles.gallery}>
    {[...entries].sort((a,b) => Number(b.kind === 'logo')-Number(a.kind === 'logo')).map(e => <figure key={e.id}>
      <img src={`${mediaPath(shopId,false)}/${e.id}`} alt={e.altText} width={e.width} height={e.height} className={e.kind === 'logo' ? styles.logo : styles.photo} loading="lazy"/>
      {(e.caption || e.creditText) && <figcaption>{e.caption && <p>{e.caption}</p>}{e.creditText && <p>{e.creditText}</p>}</figcaption>}
    </figure>)}
  </section>;
}
