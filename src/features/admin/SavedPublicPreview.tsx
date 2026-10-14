'use client';

import { useEffect, useState } from 'react';
import { ShopDetailView } from '@/src/components/shops/ShopDetailView';
import { Button } from '@/src/components/ui/Button';
import { Icon } from '@/src/components/ui/Icon';
import { useAccountSession } from '@/src/features/account/AccountSessionProvider';
import { decodeShop, decodeOptions, UUID, SHOP_REVISION, type ShopRecord } from './shop-contract';
import { decodeShopMedia, mediaPath, type ShopMedia } from './media-contract';
import { projectSavedShopPreview } from './public-preview';
import actionStyles from '@/src/components/shops/ShopActions.module.css';
import saveStyles from '@/src/components/shops/ShopSaveButton.module.css';
import { readMediaReview, MediaReviewFailure } from './media-review';
import { resolvePreviewSelection, type PreviewSelection } from './preview-selection';
import { SelectedPreviewReceiver } from './SelectedPreviewReceiver';
import { SelectedStampPreview } from './SelectedStampPreview';
import type { AdminStampVersion } from './stamp-contract';
import reviewStyles from './MediaReview.module.css';
import type { ShopDetail } from '@/src/domain/shop-detail';

interface Snapshot { record: ShopRecord; shop: ShopDetail | null; media: ShopMedia[]; stamp?: AdminStampVersion | undefined }

/** Private shell only. Every read goes through the existing live-role APIs. */
export function SavedPublicPreview({id, revision, selected = false}: {id: string; revision: string; selected?: boolean}) {
  const {session} = useAccountSession();
  if (session.status !== 'signed-in') return <p role="status">Sign in with current editor or admin access to view this preview.</p>;
  if (selected) return <SelectedPreviewReceiver key={`${session.userId}:${id}:${revision}`} id={id} revision={revision} userId={session.userId}>
    {selection => <AuthorizedPreview id={id} revision={revision} selection={selection}/>}
  </SelectedPreviewReceiver>;
  return <AuthorizedPreview key={session.userId} id={id} revision={revision}/>;
}

function AuthorizedPreview({id,revision,selection}: {id:string;revision:string;selection?:PreviewSelection}) {
  const [result, setResult] = useState<{key:string; snapshot?:Snapshot; error?:string} | null>(null);
  const key = `${id}:${revision}:${JSON.stringify(selection)}`;
  useEffect(() => {
    const controller = new AbortController();
    if (!UUID.test(id) || !SHOP_REVISION.test(revision)) return;
    const read = async (path:string) => {
      const response = await fetch(path, {signal:controller.signal,cache:'no-store',credentials:'same-origin'});
      if (!response.ok) throw Error(response.status === 401 || response.status === 403 ? 'Sign in with current editor or admin access to view this preview.' : 'The saved preview could not load. Refresh the preview to try again.');
      return response.json();
    };
    const load = async (): Promise<Snapshot> => {
      if (selection) {
        const [review, choices] = await Promise.all([readMediaReview({id,revision}, controller.signal), read('/api/v1/admin/shops/options')]);
        const selected = resolvePreviewSelection(review, selection);
        return {record:review.record, shop:projectSavedShopPreview(review.record, decodeOptions(choices)), ...selected};
      }
      const [raw, choices] = await Promise.all([read(`/api/v1/admin/shops/${id}`),read('/api/v1/admin/shops/options')]);
      const record = decodeShop(raw);
      if (record.id !== id || record.revision !== revision) throw Error('This saved version has changed. Reload the saved shop in the editor and review it again.');
      const shop = projectSavedShopPreview(record,decodeOptions(choices));
      // Incomplete drafts have no public-page layout or gallery to render.
      // Their field guidance must not depend on the separate media service.
      const media = shop ? decodeShopMedia((await read(mediaPath(id))).entries,true).filter(m => m.status === 'approved') : [];
      return {record,shop,media};
    };
    void load().then(snapshot => {
      if (!controller.signal.aborted) setResult({key,snapshot});
    }).catch(error => {
      if (!controller.signal.aborted) setResult({key,error:error instanceof MediaReviewFailure ? error.message : error instanceof Error && [
        'Sign in with current editor or admin access to view this preview.',
        'The saved preview could not load. Refresh the preview to try again.',
        'This saved version has changed. Reload the saved shop in the editor and review it again.',
        'Saved images or artwork have changed. Reload the media comparison and choose again.',
        'These preview choices are unavailable. Reload the media comparison and choose again.',
      ].includes(error.message) ? error.message : 'The saved preview could not load. Refresh the preview to try again.'});
    });
    return () => controller.abort();
  }, [id,revision,key,selection]);
  if (!UUID.test(id) || !SHOP_REVISION.test(revision)) return <p role="alert">Invalid preview link.</p>;
  const current = result?.key === key ? result : null;
  if (current?.error) return <p role="alert">{current.error}</p>;
  if (!current?.snapshot) return <p role="status">Loading saved public-page preview…</p>;
  const {shop, record, media, stamp} = current.snapshot;
  if (!shop) return <section aria-label="Incomplete preview"><h1>{String(record.document.shop.name)}</h1><p>Complete the saved location, timezone and shop type to see the public-page layout. Use the Review section’s Fix actions. No missing facts have been filled in.</p></section>;
  const stopLink = (event: React.MouseEvent) => {
    // Keep corrections/directions/website links from leaving the review frame.
    if (event.target instanceof Element && event.target.closest('a')) event.preventDefault();
  };
  return <>
  <article aria-label="Public page preview" onClickCapture={stopLink} onAuxClickCapture={stopLink}>
    <p>{selection ? 'Selected images · Temporary public-page layout preview' : 'Saved private content · Public-page layout preview'}</p>
    {shop.sourceQuality === 'demo' && <p>Demo data — not a verified shop listing.</p>}
    <ShopDetailView shop={shop} nearby={[]} previewMedia={media}
      back={null} statusBadges={null}
      save={<button type="button" className={saveStyles.save} aria-disabled="true" aria-pressed="false" aria-label="Save shop"><Icon name="bookmark" size={22}/></button>}
      actions={<div className={actionStyles.actions}><Button variant="quiet" aria-disabled="true"><Icon name="directions" size={18}/>Directions</Button><Button variant="stamp" aria-disabled="true"><Icon name="seal" size={18}/>Collect Stamp</Button></div>}
    />
  </article>
  {selection && <section className={reviewStyles.panel} aria-label="Selected collection artwork">
    <h2>Collection artwork · separate from the public page</h2>
    <p>This is the selected design for inspection, not an activation or a new collection. Existing impressions keep their original artwork.</p>
    {stamp ? <SelectedStampPreview headingAs="h3" record={record} localityName={shop.localityName} selectedStamp={stamp}/> : <p>No stamp design selected.</p>}
  </section>}
  </>;
}
