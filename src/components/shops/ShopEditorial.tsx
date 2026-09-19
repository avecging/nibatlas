import type { EditorialContent } from '@/src/domain/shop-detail';
import styles from './ShopDetailView.module.css';

export function ShopEditorial({ content: c, section }: { content?: EditorialContent | undefined; section: 'story' | 'visit' }) {
  if (!c) return null;
  const text = (heading: string, value?: string) => value ? <section className={styles.subsection} key={heading}>
    <h3 className={styles.subheading}>{heading}</h3>
    {value.split(/\n\s*\n/).map((p, i) => <p key={i} style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{p}</p>)}
  </section> : null;
  if (section === 'visit') return <>
    {text('Local-language address', c.local_address)}{text('Unit / floor', c.unit_floor)}
    {text('Nearest station', [c.nearest_station,c.station_exit,c.walking_guidance].filter(Boolean).join(' · '))}
    {text('Getting there', c.entrance_notes)}{text('Payment methods', c.payment_methods)}
    {text('Languages spoken', c.languages)}{text('Holiday note', c.holiday_note)}
    {c.appointment_required !== undefined && text('Appointment required', c.appointment_required ? 'Yes' : 'No')}
    {text('Accessibility', c.accessibility_notes)}
  </>;
  return <>
    {c.feature_headline && <h2 className={styles.sectionTitle}>{c.feature_headline}</h2>}
    {(c.field_note_heading || c.field_note_body) && <section className={styles.section}>
      <p className={styles.eyebrow}>Nib Atlas field notes</p>
      {text(c.field_note_heading || 'Why this place deserves a visit', c.field_note_body)}
      {c.field_note_heading && !c.field_note_body && <h3>{c.field_note_heading}</h3>}
    </section>}
    {!!c.experiences?.length && <section className={styles.section} aria-label="Editorial experiences">
      <h2 className={styles.sectionTitle}>Experiences</h2>
      {c.experiences.map(e => <div key={e.id}>
        <p>{e.category.replaceAll('_', ' ')}</p><h3>{e.title}</h3>
        {e.description && <p style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{e.description}</p>}
      </div>)}
    </section>}
    {text('Store editions', c.editions_text)}
  </>;
}
