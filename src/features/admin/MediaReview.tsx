'use client';
/* eslint-disable @next/next/no-img-element -- Authenticated private bytes must not pass through a public image proxy. */
import { useEffect, useState } from 'react';
import { ShopMediaSnapshotProvider } from '@/src/components/shops/ShopMediaProvider';
import { ShopMediaGallery } from '@/src/components/shops/ShopMediaGallery';
import { StampArt } from '@/src/components/stamps/StampArt';
import { countryLabel, isCountryCode } from '@/src/domain/geo';
import { validCreatorCredit } from '@/src/domain/creator-credit';
import { mediaPath } from './media-contract';
import { StampPreview } from './ShopStampAdmin';
import { comparisonMedia, MediaReviewFailure, readMediaReview, type MediaReviewSnapshot } from './media-review';
import type { ShopRecord } from './shop-contract';
import styles from './MediaReview.module.css';

export function MediaReview({record, localityName, onOpenPhotos, onOpenStamp}: {
  record: ShopRecord; localityName: string; onOpenPhotos: () => void; onOpenStamp: () => void;
}) {
  const [attempt, setAttempt] = useState(0);
  return <section className={styles.panel} aria-label="Compare saved images and artwork">
    <h3>Compare saved images and artwork</h3>
    <p>Try private photos, a replacement logo and a stamp design together before deciding what to publish.</p>
    <p className={styles.help}>These choices are only for this comparison. They reset when you reload this comparison, leave Review or save a new shop version. They do not publish images, activate artwork or change the public-page preview below. Unsaved uploads and caption edits are excluded.</p>
    <button type="button" onClick={() => setAttempt(n => n + 1)}>Reload media comparison</button>
    <Comparison key={`${record.id}:${record.revision}:${attempt}`} record={record} localityName={localityName}/>
    <div className={styles.actions}>
      <button type="button" onClick={onOpenPhotos}>Manage photos &amp; logo</button>
      <button type="button" onClick={onOpenStamp}>Manage stamp artwork</button>
    </div>
    <p className={styles.help}>Use Photos &amp; logo to publish images and Stamp to activate a design. Publishing the shop below does neither. Media can change in another session; reload to compare again. This comparison is not publication approval.</p>
  </section>;
}

function Comparison({record, localityName}: {record: ShopRecord; localityName: string}) {
  const [result, setResult] = useState<{snapshot?: MediaReviewSnapshot; error?: string} | null>(null);
  const {id, revision} = record;
  useEffect(() => {
    const controller = new AbortController();
    void readMediaReview({id, revision}, controller.signal).then(snapshot => {
      if (!controller.signal.aborted) setResult({snapshot});
    }).catch(error => {
      if (!controller.signal.aborted) setResult({error:error instanceof MediaReviewFailure ? error.message : 'Saved images and artwork could not load. Try loading them again.'});
    });
    return () => controller.abort();
  }, [id, revision]);
  if (result?.error) return <p role="alert">{result.error}</p>;
  if (!result?.snapshot) return <p role="status">Loading saved images and artwork…</p>;
  return <Choices record={record} localityName={localityName} snapshot={result.snapshot}/>;
}

function Choices({record, localityName, snapshot}: {record: ShopRecord; localityName: string; snapshot: MediaReviewSnapshot}) {
  const {media, stamps} = snapshot;
  const [photos, setPhotos] = useState<string[]>([]);
  const [logo, setLogo] = useState<string | null>(media.find(m => m.kind === 'logo' && m.status === 'approved')?.id ?? null);
  const [stamp, setStamp] = useState<string | null>(stamps.find(s => s.active)?.id ?? null);
  const selected = comparisonMedia(media, photos, logo);
  const selectedLogo = selected.find(m => m.kind === 'logo');
  const selectedStamp = stamps.find(s => s.id === stamp);
  const stampChoices = stamps.filter(s => s.active || (s.kind === 'uploaded' && s.status === 'draft'));
  const name = String(record.document.shop.name);
  const country = String(record.document.shop.country_code ?? '');
  const live = record.publicationStatus === 'published';
  return <>
    <fieldset><legend>Photos to compare</legend>
      <p className={styles.help}>Approved photos stay included. Selected private photos join them in saved gallery order; the first included photo is the comparison cover.</p>
      <div className={styles.choices}>{media.filter(m => m.kind === 'photo' && m.status !== 'rejected').map(entry => <div className={styles.choice} key={entry.id}>
        <label><input type="checkbox" checked={entry.status === 'approved' || photos.includes(entry.id)} disabled={entry.status === 'approved'}
          onChange={event => setPhotos(current => event.target.checked ? [...current, entry.id] : current.filter(id => id !== entry.id))}/>
          <span>{entry.altText} · {entry.status === 'approved' ? live ? 'Public' : 'Approved, shop not public' : 'Private'}</span></label>
        <PrivateImage className={styles.thumbnail} src={`${mediaPath(record.id)}/${entry.id}`} alt={entry.altText}/>
        {entry.caption && <p>{entry.caption}</p>}
        {entry.creditText && <p className={styles.help}>{entry.creditText}</p>}
      </div>)}</div>
      {!media.some(m => m.kind === 'photo' && m.status !== 'rejected') && <p>No saved photos.</p>}
    </fieldset>
    <fieldset><legend>Logo to compare</legend>
      <div className={styles.choices}><label className={styles.choice}><span><input type="radio" name="comparison-logo" checked={logo === null} onChange={() => setLogo(null)}/> No logo in comparison</span></label>
        {media.filter(m => m.kind === 'logo' && m.status !== 'rejected').map(entry => <div className={styles.choice} key={entry.id}>
          <label><input type="radio" name="comparison-logo" checked={logo === entry.id} onChange={() => setLogo(entry.id)}/><span>{entry.altText} · {entry.status === 'approved' ? live ? 'Public' : 'Approved, shop not public' : 'Private replacement'}</span></label>
          <PrivateImage className={styles.thumbnail} src={`${mediaPath(record.id)}/${entry.id}`} alt={entry.altText}/>
        </div>)}
      </div>
    </fieldset>
    <div aria-label="Selected gallery comparison">
      <h4>Selected gallery and logo</h4>
      <p className={styles.help}>Comparison only · saved gallery layout and captions</p>
      {selectedLogo ? <PrivateImage key={selectedLogo.id} className={styles.logo} src={`${mediaPath(record.id)}/${selectedLogo.id}`} alt={selectedLogo.altText}/> : <p>No logo selected.</p>}
      <ShopMediaSnapshotProvider shopId={record.id} entries={selected}>
        <ShopMediaGallery key={selected.filter(m => m.kind === 'photo').map(m => m.id).join(':')} shopName={name} ariaLabel="Selected photos for comparison"/>
      </ShopMediaSnapshotProvider>
      {!selected.some(m => m.kind === 'photo') && <p>No photos selected.</p>}
    </div>
    <fieldset><legend>Stamp design to compare</legend>
      <div className={styles.choices}>{stampChoices.map(entry => <label className={styles.choice} key={entry.id}>
        <span><input type="radio" name="comparison-stamp" checked={stamp === entry.id} disabled={!entry.active && !entry.hasArtwork} onChange={() => setStamp(entry.id)}/>{' '}
          Design v{entry.designVersion} · {entry.active ? 'Current active design' : entry.hasArtwork ? 'Private draft' : 'Needs a saved PNG'}</span>
      </label>)}</div>
      {!stampChoices.length && <p>No active design or uploaded draft. Open Stamp to inspect retained versions or prepare a default.</p>}
    </fieldset>
    {selectedStamp && <div aria-label="Selected stamp comparison">
      <h4>Design v{selectedStamp.designVersion} · {selectedStamp.active ? 'Current active design' : 'Private comparison'}</h4>
      <p>{selectedStamp.kind === 'generated_template' ? 'Generated default' : selectedStamp.origin.replaceAll('_', ' ')}</p>
      {selectedStamp.creatorName && <p>created by: {selectedStamp.creatorUrl && validCreatorCredit(selectedStamp.creatorName, selectedStamp.creatorUrl)
        ? <a href={selectedStamp.creatorUrl} target="_blank" rel="noreferrer">{selectedStamp.creatorName}</a> : selectedStamp.creatorName}</p>}
      {selectedStamp.kind === 'uploaded' && selectedStamp.hasArtwork ? <StampPreview key={selectedStamp.id} shopId={record.id} entry={selectedStamp}/>
        : selectedStamp.kind === 'generated_template' && selectedStamp.templateData ? <div className={styles.generated}><StampArt title={name} stamp={{id:selectedStamp.stampId, tier:'shop', motif:selectedStamp.templateData.motif, ink:selectedStamp.ink, designVersion:selectedStamp.designVersion, paletteVersion:1, localityLabel:localityName, countryLabel:isCountryCode(country) ? countryLabel(country) : ''}}/></div>
          : <p>Artwork preview unavailable. No substitute artwork is shown.</p>}
      <p className={styles.help}>Comparison only. Activation changes the design for future collections; existing impressions retain their original artwork.</p>
    </div>}
  </>;
}

function PrivateImage({src, alt, className}: {src: string; alt: string; className: string | undefined}) {
  const [failed, setFailed] = useState(false);
  return failed ? <p role="status">Image unavailable: {alt}</p> : <img className={className} src={src} alt={alt} loading="lazy" onError={() => setFailed(true)}/>;
}
