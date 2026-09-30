'use client';
/* eslint-disable @next/next/no-img-element -- Authenticated private bytes must not pass through a public image proxy. */
import { PublicationPanel } from './PublicationPanel';
import { useEffect, useRef, useState } from 'react';
import { ShopMediaSnapshotProvider } from '@/src/components/shops/ShopMediaProvider';
import { ShopMediaGallery } from '@/src/components/shops/ShopMediaGallery';
import { mediaPath } from './media-contract';
import { comparisonMedia, MediaReviewFailure, mediaReviewFingerprint, type MediaReviewSnapshot } from './media-review';
import type { ShopRecord } from './shop-contract';
import styles from './MediaReview.module.css';
import { SelectedStampPreview } from './SelectedStampPreview';
import { SelectedPreviewFrame } from './SelectedPreviewFrame';
import { decodeReviewState, reviewPath, type ReviewState } from './review-contract';

export function MediaReview({record, localityName, onOpenPhotos, onOpenStamp, canPublish = false, publicationDisabled = false}: {
  canPublish?: boolean; publicationDisabled?: boolean; record: ShopRecord; localityName: string; onOpenPhotos: () => void; onOpenStamp: () => void;
}) {
  const [attempt, setAttempt] = useState(0);
  return <section className={styles.panel} aria-label="Compare saved images and artwork">
    <h3>Compare saved images and artwork</h3>
    <p>Try private photos, a replacement logo and a stamp design together before deciding what to publish.</p>
    <p className={styles.help}>Save reviewed choices to remember them for your account. Unsaved choices reset when you leave or reload Review. If saved content changes, review it again. Saving a review does not publish images, activate artwork or change the approved-only public-page preview below. Unsaved uploads and caption edits are excluded.</p>
    <button type="button" onClick={() => setAttempt(n => n + 1)}>Reload media comparison</button>
    <Comparison key={`${record.id}:${record.revision}:${attempt}`} record={record} localityName={localityName} canPublish={canPublish} publicationDisabled={publicationDisabled}/>
    <div className={styles.actions}>
      <button type="button" onClick={onOpenPhotos}>Manage photos &amp; logo</button>
      <button type="button" onClick={onOpenStamp}>Manage stamp artwork</button>
    </div>
    <p className={styles.help}>Admins can publish saved reviewed choices together here. The separate shop-only publish action below changes no images or artwork. Media can change in another session; the server checks again before publication.</p>
  </section>;
}

function Comparison({record, localityName, canPublish, publicationDisabled}: {record: ShopRecord; localityName: string; canPublish: boolean; publicationDisabled: boolean}) {
  const [result, setResult] = useState<{snapshot?: MediaReviewSnapshot; state?: ReviewState; error?: string} | null>(null);
  const {id, revision} = record;
  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      const response = await fetch(reviewPath(id),{signal:controller.signal,cache:'no-store',credentials:'same-origin'});
      if (!response.ok) throw new MediaReviewFailure(response.status === 401 || response.status === 403
        ? 'Sign in with current editor or admin access to review saved images and artwork.'
        : 'Saved review could not load. Try loading it again.');
      const state = decodeReviewState(await response.json());
      if (state.record.id !== id || state.record.revision !== revision) throw new MediaReviewFailure(
        'The saved shop has changed. Reload the saved version in the editor before comparing images and artwork.');
      const snapshot = {...state,fingerprint:await mediaReviewFingerprint(state)};
      if (!controller.signal.aborted) setResult({snapshot,state});
    })().catch(error => {
      if (!controller.signal.aborted) setResult({error:error instanceof MediaReviewFailure ? error.message : 'Saved images and artwork could not load. Try loading them again.'});
    });
    return () => controller.abort();
  }, [id, revision]);
  if (result?.error) return <><p role="alert">{result.error}</p>{canPublish && <PublicationPanel shop={record.id} review={null} disabled={publicationDisabled}/>}</>;
  if (!result?.snapshot || !result.state) return <p role="status">Loading saved images and artwork…</p>;
  return <Choices record={record} localityName={localityName} snapshot={result.snapshot} state={result.state} canPublish={canPublish} publicationDisabled={publicationDisabled}/>;
}

function Choices({record, localityName, snapshot, state, canPublish, publicationDisabled}: {record: ShopRecord; localityName: string; snapshot: MediaReviewSnapshot; state: ReviewState; canPublish: boolean; publicationDisabled: boolean}) {
  const {media, stamps} = snapshot;
  const [showPage, setShowPage] = useState(false);
  const [photos, setPhotos] = useState<string[]>(state.review?.choices.photos ?? []);
  const [logo, setLogo] = useState<string | null>(state.review ? state.review.choices.logo : media.find(m => m.kind === 'logo' && m.status === 'approved')?.id ?? null);
  const [stamp, setStamp] = useState<string | null>(state.review ? state.review.choices.stamp : stamps.find(s => s.active)?.id ?? null);
  const [review, setReview] = useState(state.review);
  const [saving, setSaving] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [message, setMessage] = useState('');
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  const choices = {photos,logo,stamp};
  const unchanged = review && JSON.stringify(review.choices) === JSON.stringify(choices);
  const current = review?.current && unchanged && !blocked;
  const unavailable = photos.some(id => !media.some(m => m.id === id && m.kind === 'photo' && m.status !== 'rejected'))
    || logo !== null && !media.some(m => m.id === logo && m.kind === 'logo' && m.status !== 'rejected')
    || stamp !== null && !state.availableStampIds.includes(stamp);
  async function saveReview() {
    setSaving(true); setMessage('');
    const pending = new AbortController(); controller.current = pending;
    const payload = {id:crypto.randomUUID(),previousId:review?.id ?? null,reviewKey:state.reviewKey,choices};
    try {
      const response = await fetch(reviewPath(record.id),{method:'POST',headers:{'Content-Type':'application/json'},
        credentials:'same-origin',cache:'no-store',signal:pending.signal,body:JSON.stringify(payload)});
      if (!response.ok) throw new Error(response.status === 409
        ? 'Saved content or your review changed. Reload the media comparison and review again.'
        : response.status === 401 || response.status === 403 ? 'Access changed. Sign in with current editor or admin access, then reload Review.'
        : 'The review save could not be confirmed. Reload the media comparison to check whether it was saved.');
      const saved = decodeReviewState(await response.json());
      if (saved.record.id !== record.id || saved.record.revision !== record.revision || saved.reviewKey !== state.reviewKey
        || saved.review?.id !== payload.id || !saved.review.current
        || JSON.stringify(saved.review.choices) !== JSON.stringify(choices)) throw new Error('Saved content changed. Reload the media comparison and review again.');
      if (!pending.signal.aborted) { setReview(saved.review); setMessage('Reviewed choices saved. Nothing was published or activated.'); }
    } catch (error) {
      if (!pending.signal.aborted) { setBlocked(true); setMessage(error instanceof Error ? error.message : 'Reload the media comparison to check the saved review.'); }
    } finally { if (!pending.signal.aborted) setSaving(false); }
  }
  const selected = comparisonMedia(media, photos, logo);
  const selectedLogo = selected.find(m => m.kind === 'logo');
  const selectedStamp = stamps.find(s => s.id === stamp);
  const stampChoices = stamps.filter(s => s.active || (s.kind === 'uploaded' && s.status === 'draft'));
  const name = String(record.document.shop.name);
  const live = record.publicationStatus === 'published';
  return <>
    <div role="status">
      {blocked ? 'Reload the saved version before reviewing further changes. Check any recorded publication outcome first.' : current ? 'Reviewed choices saved for the loaded content. Reload to check for changes.' : review && !review.current
        ? 'Review again: saved content has changed. Your previous choices are remembered, but the old review is no longer current.'
        : 'These choices have not been saved as a review.'}
    </div>
    {state.conflict && <p role="alert">Public shop details changed beneath the saved draft. Reconcile the draft in the editor before saving a new review.</p>}
    {unavailable && <div role="alert"><p>Some remembered choices are no longer available. Choose available replacements before saving a new review.</p>
      <button type="button" disabled={saving} onClick={() => {
        setPhotos(photos.filter(id => media.some(m => m.id === id && m.kind === 'photo' && m.status !== 'rejected')));
        if (!media.some(m => m.id === logo && m.kind === 'logo' && m.status !== 'rejected')) setLogo(null);
        if (stamp !== null && !state.availableStampIds.includes(stamp)) setStamp(null);
      }}>Clear unavailable choices</button></div>}
    <fieldset disabled={saving}><legend>Photos to compare</legend>
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
    <fieldset disabled={saving}><legend>Logo to compare</legend>
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
    <fieldset disabled={saving}><legend>Stamp design to compare</legend>
      <div className={styles.choices}>{stampChoices.map(entry => <label className={styles.choice} key={entry.id}>
        <span><input type="radio" name="comparison-stamp" checked={stamp === entry.id} disabled={!state.availableStampIds.includes(entry.id)} onChange={() => setStamp(entry.id)}/>{' '}
          Design v{entry.designVersion} · {!state.availableStampIds.includes(entry.id) ? entry.hasArtwork ? 'Unavailable in this environment' : 'Needs a saved PNG' : entry.active ? 'Current active design' : 'Private draft'}</span>
      </label>)}</div>
      {!stampChoices.length && <p>No active design or uploaded draft. Open Stamp to inspect retained versions or prepare a default.</p>}
    </fieldset>
    {selectedStamp && <SelectedStampPreview record={record} localityName={localityName} selectedStamp={selectedStamp}/>}
    <button type="button" disabled={saving || blocked || state.conflict || unavailable || Boolean(current)} onClick={() => void saveReview()}>{saving ? 'Saving reviewed choices…' : 'Save reviewed choices'}</button>
    {canPublish && <PublicationPanel shop={record.id} review={current && !state.conflict && !unavailable && record.positionConfirmed ? review : null}
      disabled={publicationDisabled || saving} onAttempt={() => {setBlocked(true);setShowPage(false);setMessage('');}}/>}
    {message && <p role={blocked ? 'alert' : 'status'}>{message}</p>}
    <button type="button" aria-expanded={showPage} onClick={() => setShowPage(value => !value)}>{showPage ? 'Close selected page preview' : 'Preview these choices on the page'}</button>
    {showPage && <SelectedPreviewFrame selection={{shopId:record.id, revision:record.revision, fingerprint:snapshot.fingerprint, photos, logo, stamp}}/>}
  </>;
}

function PrivateImage({src, alt, className}: {src: string; alt: string; className: string | undefined}) {
  const [failed, setFailed] = useState(false);
  return failed ? <p role="status">Image unavailable: {alt}</p> : <img className={className} src={src} alt={alt} loading="lazy" onError={() => setFailed(true)}/>;
}
