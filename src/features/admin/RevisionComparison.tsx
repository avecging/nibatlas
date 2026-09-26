import { GROUPS, SHOP_FIELDS, type Document, type Value } from './shop-contract';
import styles from './ShopAdmin.module.css';

function describe(value: Value | undefined): string {
  if (value == null || value === '') return '(empty / unknown)';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) return value.map(describe).join('\n') || '(empty)';
  if (typeof value === 'object') return Object.entries(value).map(([key,v]) => `${key.replaceAll('_',' ')}: ${describe(v)}`).join('\n');
  return String(value);
}

/** Read-only comparison. It never rebases a full replacement document onto a newer revision. */
export function RevisionComparison({mine,latest}: {mine:Document;latest:Document}) {
  const rows = [
    ...SHOP_FIELDS.map(f => ({label:f.label,mine:mine.shop[f.key],latest:latest.shop[f.key]})),
    {label:'Opening hours',mine:mine.shop.opening_hours,latest:latest.shop.opening_hours},
    ...GROUPS.map(g => ({label:g.label,mine:mine[g.key],latest:latest[g.key]})),
  ].filter(row => JSON.stringify(row.mine) !== JSON.stringify(row.latest));
  return <section className={styles.box} aria-label="Compare with latest saved version">
    <h3>Compare with latest saved version</h3>
    <p>Your edits are still in the editor. This comparison is read-only; it does not change the revision used by Save. Reload only when you are ready to discard your local edits and work from the newer version.</p>
    {!rows.length && <p>The latest saved content matches your editor. Reload to recover its current revision.</p>}
    {rows.map(row => <section key={row.label} className={styles.card}>
      <h4>{row.label}</h4>
      <div className={styles.grid}>
        <div><strong>Your editor</strong><p className={styles.comparisonValue}>{describe(row.mine)}</p></div>
        <div><strong>Latest saved</strong><p className={styles.comparisonValue}>{describe(row.latest)}</p></div>
      </div>
    </section>)}
  </section>;
}
