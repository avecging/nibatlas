import { StampArt } from '@/src/components/stamps/StampArt';
import { countryLabel, isCountryCode } from '@/src/domain/geo';
import { validCreatorCredit } from '@/src/domain/creator-credit';
import { StampPreview } from './ShopStampAdmin';
import type { ShopRecord } from './shop-contract';
import type { AdminStampVersion } from './stamp-contract';
import styles from './MediaReview.module.css';

export function SelectedStampPreview({record, localityName, selectedStamp, headingAs: Heading = 'h4'}: {headingAs?: 'h3' | 'h4'; record: ShopRecord; localityName: string; selectedStamp: AdminStampVersion}) {
  const name = String(record.document.shop.name);
  const country = String(record.document.shop.country_code ?? '');
  return <div aria-label="Selected stamp comparison">
      <Heading>Design v{selectedStamp.designVersion} · {selectedStamp.active ? 'Current active design' : 'Private comparison'}</Heading>
      <p>{selectedStamp.kind === 'generated_template' ? 'Generated default' : selectedStamp.origin.replaceAll('_', ' ')}</p>
      {selectedStamp.creatorName && <p>created by: {selectedStamp.creatorUrl && validCreatorCredit(selectedStamp.creatorName, selectedStamp.creatorUrl)
        ? <a href={selectedStamp.creatorUrl} target="_blank" rel="noreferrer">{selectedStamp.creatorName}</a> : selectedStamp.creatorName}</p>}
      {selectedStamp.kind === 'uploaded' && selectedStamp.hasArtwork ? <StampPreview key={selectedStamp.id} shopId={record.id} entry={selectedStamp}/>
        : selectedStamp.kind === 'generated_template' && selectedStamp.templateData ? <div className={styles.generated}><StampArt title={name} stamp={{id:selectedStamp.stampId, tier:'shop', motif:selectedStamp.templateData.motif, ink:selectedStamp.ink, designVersion:selectedStamp.designVersion, paletteVersion:1, localityLabel:localityName, countryLabel:isCountryCode(country) ? countryLabel(country) : ''}}/></div>
          : <p>Artwork preview unavailable. No substitute artwork is shown.</p>}
      <p className={styles.help}>Comparison only. Activation changes the design for future collections; existing impressions retain their original artwork.</p>
    </div>;
}
