"use client";
import { useEffect, useRef, useState } from 'react';
import { decodePublication, publicationPath, type Publication } from './publication-contract';
import type { ReviewChoices } from './review-contract';

export function PublicationPanel({shop, review, disabled, onAttempt}: {
  shop: string; review: {id: string; choices: ReviewChoices} | null; disabled: boolean; onAttempt?: () => void;
}) {
  const [result, setResult] = useState<Publication | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<'publish' | 'retry' | null>(null);
  const [message, setMessage] = useState('');
  const [uncertain, setUncertain] = useState(false);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => {
    const pending = new AbortController(); controller.current = pending;
    void read(pending);
    return () => controller.current?.abort();
    // This panel is keyed by shop in the editor; no private browser storage.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shop]);
  async function read(pending: AbortController) {
    setBusy(true); setConfirm(null);
    try {
      const response = await fetch(publicationPath(shop),{signal:pending.signal,credentials:'same-origin',cache:'no-store'});
      if (!response.ok) throw Error();
      const next = decodePublication(await response.json()).publication;
      if (!pending.signal.aborted) {setResult(next);setLoaded(true);setUncertain(false);setMessage('');}
    } catch { if (!pending.signal.aborted) {setUncertain(true);setMessage('Publication outcome could not be checked. Check the outcome before trying again.');} }
    finally { if (!pending.signal.aborted) setBusy(false); }
  }
  async function publish(action: 'publish' | 'retry') {
    const reviewId = action === 'publish' ? review?.id : result?.reviewId;
    if (!reviewId) return;
    setBusy(true);setConfirm(null);setMessage('');
    const pending = new AbortController();controller.current = pending;
    try {
      const response = await fetch(publicationPath(shop),{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({action,reviewId}),signal:pending.signal,credentials:'same-origin',cache:'no-store'});
      if (!response.ok) throw Error(response.status === 409
        ? 'Saved content or your review changed. Reload the saved shop and review again; completed parts stay completed.'
        : response.status === 401 || response.status === 403 ? 'Access changed. Sign in with current admin access, then check the outcome.'
        : 'Publication could not be confirmed. Check the outcome before trying again.');
      const next = decodePublication(await response.json()).publication;
      if (!next || next.reviewId !== reviewId) throw Error('Publication could not be confirmed. Check the outcome before trying again.');
      if (!pending.signal.aborted) {setResult(next);setUncertain(false);}
    } catch (error) { if (!pending.signal.aborted) {setUncertain(true);setMessage(error instanceof Error ? error.message : 'Check the publication outcome.');} }
    finally { if (!pending.signal.aborted) {setBusy(false);onAttempt?.();} }
  }
  const used = result?.reviewId === review?.id;
  const canPublish = loaded && !!review && !disabled && !busy && !uncertain && !used;
  return <section aria-label="Combined publication">
    <h4>Publish the reviewed shop and choices</h4>
    <p>This publishes the saved shop, keeps approved photos and adds selected private photos. The selected logo replaces the current logo; choosing no logo keeps the current public logo. A selected stamp becomes active for future collections. With no stamp selected, the active design is kept. Past collections stay unchanged.</p>
    <p>Confirm the saved position in Location, save your edits, then save reviewed choices before publishing. Only admins can publish images and activate artwork.</p>
    {result && <div role="status">
      <p><strong>{result.status === 'complete' ? 'Publication complete.' : result.status === 'partial' ? 'Partly published.' : 'Nothing was published by this attempt.'}</strong> This is the recorded outcome of the last attempt, not a live page check.</p>
      <ul>{result.outcomes.map((item,index) => <li key={`${item.kind}:${item.targetId ?? index}`}>
        {item.kind === 'photo' ? `Selected photo ${index - 1}` : item.kind === 'shop' ? 'Shop details' : item.kind === 'stamp' ? 'Stamp design' : 'Logo'}: {item.status === 'succeeded' ? 'Done (published or already current)' : item.status === 'pending' ? 'Not attempted' : 'Failed'}
        {item.reason === 'requirements' ? ' — check saved requirements and review again.' : item.reason === 'review_again' ? ' — reload and review again.' : item.reason === 'unavailable' ? ' — temporarily unavailable.' : ''}
      </li>)}</ul>
      {result.status !== 'complete' && !result.canRetry && <p>Saved content or the review changed. Reload the saved shop and review again. Successful parts will be kept.</p>}
      <p>Reload the saved version in the editor to see the latest shop details and review any further changes.</p>
    </div>}
    {message && <p role="alert">{message}</p>}
    <button type="button" disabled={busy} onClick={() => {const pending=new AbortController();controller.current=pending;void read(pending);}}>Check publication outcome</button>
    <button type="button" disabled={!canPublish} onClick={() => setConfirm('publish')}>Publish reviewed shop and choices</button>
    {result?.canRetry && <button type="button" disabled={busy || uncertain || disabled} onClick={() => setConfirm('retry')}>Retry unfinished parts</button>}
    {confirm && <div aria-label="Confirm combined publication">
      <p>{confirm === 'retry' ? 'Retry only unfinished parts of this recorded attempt? The server will first check that saved content still matches.'
        : `Publish the saved shop with ${review?.choices.photos.length ?? 0} selected photos, ${review?.choices.logo ? 'the selected logo' : 'the current public logo'}, and ${review?.choices.stamp ? 'the selected stamp design' : 'the current active stamp'}?`}</p>
      <button type="button" disabled={busy || disabled || (confirm === 'publish' && !canPublish)} onClick={() => void publish(confirm)}>Yes, {confirm === 'retry' ? 'retry unfinished parts' : 'publish these reviewed choices'}</button>
      <button type="button" disabled={busy} onClick={() => setConfirm(null)}>Cancel publication</button>
    </div>}
    {busy && <p role="status">Checking publication…</p>}
  </section>;
}
