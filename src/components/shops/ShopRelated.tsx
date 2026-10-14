import Link from 'next/link';
import { countryLabel } from '@/src/domain/geo';
import type { RelatedShop } from '@/src/domain/shop-detail';
import styles from './ShopDetailView.module.css';
function rows(shops: readonly RelatedShop[]) {
  return <ul className={styles.relatedList}>{shops.map(shop=><li key={shop.id}>
    <Link className={styles.nearbyRow} href={`/shops/${shop.slug}`}>
      <span className={styles.nearbyName}>{shop.name}</span>
      <span className={styles.nearbyMeta}>{shop.localityName} · {countryLabel(shop.countryCode)}</span>
      <span className={styles.tag}>{shop.kind==='branch'?'Branch':'Related shop'}</span>
    </Link>
  </li>)}</ul>;
}
export function ShopRelated({shops,headingId}: {shops:readonly RelatedShop[];headingId:string}) {
  if(!shops.length) return null;
  const branches=shops.filter(shop=>shop.kind==='branch');
  const related=shops.filter(shop=>shop.kind!=='branch');
  return <section className={styles.section} aria-labelledby={headingId}>
    <h2 id={headingId} className={styles.sectionTitle}>Related shops</h2>
    {!!branches.length && <details className={styles.branchDisclosure}>
      <summary>Other branches ({branches.length})</summary>
      {rows(branches)}
    </details>}
    {!!related.length && rows(related)}
  </section>;
}
