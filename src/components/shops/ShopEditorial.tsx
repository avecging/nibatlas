import { DEFAULT_EXPERIENCE_ICON } from '@/src/domain/experience-icons';
import type { EditorialContent } from '@/src/domain/shop-detail';
import { ExperienceIcon } from '@/src/components/ui/ExperienceIcon';
import styles from './ShopDetailView.module.css';

/**
 * The shop's own story, as the founder published it.
 *
 * Only the story half now. The practical editorial fields — station, floor,
 * payment, languages, holidays, accessibility, appointment — used to render here
 * as a second set of subsections beside the sourced `access`/`practical` rows in
 * *Plan your visit*, which put the same station on the page twice. They are
 * resolved once in `shop-visit-facts.ts` and rendered once by `ShopDetailView`.
 */
export function ShopEditorial({ content: c }: { content?: EditorialContent | undefined }) {
  if (!c) return null;
  const paragraphs = (value: string) => value.split(/\n\s*\n/).map((p, i) => <p key={i} className={styles.editorialBody}>{p}</p>);
  return <>
    {c.feature_headline && <h2 className={styles.sectionTitle}>{c.feature_headline}</h2>}
    {(c.field_note_heading || c.field_note_body) && <section className={styles.section} aria-label="Nib Atlas field notes">
      <p className={styles.eyebrow}>Nib Atlas field notes</p>
      <h3 className={styles.fieldNoteHeading}>{c.field_note_heading || 'Why this place deserves a visit'}</h3>
      {c.field_note_body && paragraphs(c.field_note_body)}
    </section>}
    {!!c.experiences?.length && <section className={styles.section} aria-labelledby="what-you-can-do-here">
      <h2 className={styles.sectionTitle} id="what-you-can-do-here">What you can do here</h2>
      <ul className={styles.experienceGrid}>
        {c.experiences.map(e => <li key={e.id} className={styles.experienceCard}>
          <ExperienceIcon name={e.icon ?? DEFAULT_EXPERIENCE_ICON} size={18} />
          <div>
            <p className={styles.experienceCategory}>{e.category.replaceAll('_', ' ')}</p>
            <h3 className={styles.experienceTitle}>{e.title}</h3>
            {e.description && <p className={styles.editorialBody}>{e.description}</p>}
          </div>
        </li>)}
      </ul>
    </section>}
    {c.editions_text && <section className={styles.section} aria-labelledby="store-editions">
      <h2 className={styles.sectionTitle} id="store-editions">Store editions</h2>
      {paragraphs(c.editions_text)}
    </section>}
  </>;
}

/**
 * The editorial visit fields, as the admin's own private draft preview shows them.
 *
 * The public page resolves these against the sourced `access`/`practical` blocks
 * in `shop-visit-facts.ts` so a station is not printed twice. The admin preview
 * has only the draft document in hand — no public read, no published record —
 * so it lists what the editor typed, and nothing here fetches anything.
 */
export function ShopEditorialVisit({ content: c }: { content?: EditorialContent | undefined }) {
  if (!c) return null;
  const text = (heading: string, value?: string) => value ? <section className={styles.subsection} key={heading}>
    <h3 className={styles.subheading}>{heading}</h3>
    {value.split(/\n\s*\n/).map((p, i) => <p key={i} className={styles.editorialBody}>{p}</p>)}
  </section> : null;
  return <>
    {text('Local-language address', c.local_address)}{text('Unit / floor', c.unit_floor)}
    {text('Nearest station', [c.nearest_station,c.station_exit,c.walking_guidance].filter(Boolean).join(' · '))}
    {text('Getting there', c.entrance_notes)}{text('Payment methods', c.payment_methods)}
    {text('Languages spoken', c.languages)}{text('Holiday note', c.holiday_note)}
    {c.appointment_required !== undefined && text('Appointment required', c.appointment_required ? 'Yes' : 'No')}
    {text('Accessibility', c.accessibility_notes)}
  </>;
}
