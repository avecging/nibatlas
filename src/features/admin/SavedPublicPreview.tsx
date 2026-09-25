'use client';

import { useEffect, useState } from 'react';
import { ShopDetailView } from '@/src/components/shops/ShopDetailView';
import { Button } from '@/src/components/ui/Button';
import { Icon } from '@/src/components/ui/Icon';
import { useAccountSession } from '@/src/features/account/AccountSessionProvider';
import { decodeShop, decodeOptions, UUID, type ShopRecord } from './shop-contract';
import { decodeShopMedia, mediaPath, type ShopMedia } from './media-contract';
import { projectSavedShopPreview } from './public-preview';
import actionStyles from '@/src/components/shops/ShopActions.module.css';
import saveStyles from '@/src/components/shops/ShopSaveButton.module.css';
import type { ShopDetail } from '@/src/domain/shop-detail';

interface Snapshot { record: ShopRecord; shop: ShopDetail | null; media: ShopMedia[] }

/** Private shell only. Every read goes through the existing live-role APIs. */
export function SavedPublicPreview({id, revision}: {id: string; revision: string}) {
  const {session} = useAccountSession();
  if (session.status !== 'signed-in') return <p role="status">Sign in with current editor or admin access to view this preview.</p>;
  return <AuthorizedPreview key={session.userId} id={id} revision={revision}/>;
}

function AuthorizedPreview({id,revision}: {id:string;revision:string}) {
  const [result, setResult] = useState<{key:string; snapshot?:Snapshot; error?:string} | null>(null);
  const key = `${id}:${revision}`;
  useEffect(() => {
    const controller = new AbortController();
    if (!UUID.test(id) || !/^[a-f0-9]{32}$/.test(revision)) return;
    const read = async (path:string) => {
      const response = await fetch(path, {signal:controller.signal,cache:'no-store',credentials:'same-origin'});
      if (!response.ok) throw Error(response.status === 401 || response.status === 403 ? 'Sign in with current editor or admin access to view this preview.' : 'The saved preview could not load. Refresh the preview to try again.');
      return response.json();
    };
    void Promise.all([read(`/api/v1/admin/shops/${id}`),read('/api/v1/admin/shops/options'),read(mediaPath(id))]).then(([raw, choices, media]) => {
      const record = decodeShop(raw);
      if (record.id !== id || record.revision !== revision) throw Error('This saved version has changed. Reload the saved shop in the editor and review it again.');
      const snapshot = {record,shop:projectSavedShopPreview(record,decodeOptions(choices)),media:decodeShopMedia(media.entries,true).filter(m => m.status === 'approved')};
      if (!controller.signal.aborted) setResult({key,snapshot});
    }).catch(error => {
      if (!controller.signal.aborted) setResult({key,error:error instanceof Error && [
        'Sign in with current editor or admin access to view this preview.',
        'The saved preview could not load. Refresh the preview to try again.',
        'This saved version has changed. Reload the saved shop in the editor and review it again.',
      ].includes(error.message) ? error.message : 'The saved preview could not load. Refresh the preview to try again.'});
    });
    return () => controller.abort();
  }, [id,revision,key]);
  if (!UUID.test(id) || !/^[a-f0-9]{32}$/.test(revision)) return <p role="alert">Invalid preview link.</p>;
  const current = result?.key === key ? result : null;
  if (current?.error) return <p role="alert">{current.error}</p>;
  if (!current?.snapshot) return <p role="status">Loading saved public-page preview…</p>;
  const {shop, record, media} = current.snapshot;
  if (!shop) return <section aria-label="Incomplete preview"><h1>{String(record.document.shop.name)}</h1><p>Complete the saved location, timezone and shop type to see the public-page layout. Use the Review section’s Fix actions. No missing facts have been filled in.</p></section>;
  const stopLink = (event: React.MouseEvent) => {
    // Keep corrections/directions/website links from leaving the review frame.
    if (event.target instanceof Element && event.target.closest('a')) event.preventDefault();
  };
  return <article aria-label="Public page preview" onClickCapture={stopLink} onAuxClickCapture={stopLink}>
    <p>Saved private content · Public-page layout preview</p>
    {shop.sourceQuality === 'demo' && <p>Demo data — not a verified shop listing.</p>}
    <ShopDetailView shop={shop} nearby={[]} previewMedia={media}
      back={null} statusBadges={null}
      save={<button type="button" className={saveStyles.save} aria-disabled="true" aria-pressed="false" aria-label="Save shop"><Icon name="bookmark" size={22}/></button>}
      actions={<div className={actionStyles.actions}><Button variant="quiet" aria-disabled="true"><Icon name="directions" size={18}/>Directions</Button><Button variant="stamp" aria-disabled="true"><Icon name="seal" size={18}/>Collect Stamp</Button></div>}
    />
  </article>;
}
