import { UUID, SHOP_REVISION, object } from './shop-contract';
import { comparisonMedia, type MediaReviewSnapshot } from './media-review';

/** In-memory preview intent only. No writer accepts this value. */
export interface PreviewSelection {
  shopId: string;
  revision: string;
  fingerprint: string;
  photos: string[];
  logo: string | null;
  stamp: string | null;
}

export function decodePreviewSelection(value: unknown): PreviewSelection {
  const r = object(value);
  const nullableId = (v: unknown) => v === null || (typeof v === 'string' && UUID.test(v));
  if (Object.keys(r).sort().join(',') !== 'fingerprint,logo,photos,revision,shopId,stamp'
    || typeof r.shopId !== 'string' || !UUID.test(r.shopId)
    || typeof r.revision !== 'string' || !SHOP_REVISION.test(r.revision)
    || typeof r.fingerprint !== 'string' || !/^[a-f0-9]{64}$/.test(r.fingerprint)
    || !Array.isArray(r.photos) || r.photos.length > 50 || new Set(r.photos).size !== r.photos.length
    || r.photos.some(id => typeof id !== 'string' || !UUID.test(id))
    || !nullableId(r.logo) || !nullableId(r.stamp)) throw Error('Invalid preview selection.');
  return r as unknown as PreviewSelection;
}

export function resolvePreviewSelection(snapshot: MediaReviewSnapshot, selection: PreviewSelection) {
  if (snapshot.record.id !== selection.shopId || snapshot.record.revision !== selection.revision
    || snapshot.fingerprint !== selection.fingerprint) throw Error('Saved images or artwork have changed. Reload the media comparison and choose again.');
  const {media, stamps} = snapshot;
  if (selection.photos.some(id => !media.some(m => m.id === id && m.kind === 'photo' && m.status !== 'rejected'))
    || (selection.logo !== null && !media.some(m => m.id === selection.logo && m.kind === 'logo' && m.status !== 'rejected'))
    || (selection.stamp !== null && !stamps.some(s => s.id === selection.stamp && (s.active || (s.kind === 'uploaded' && s.status === 'draft' && s.hasArtwork)))))
    throw Error('These preview choices are unavailable. Reload the media comparison and choose again.');
  return {media: comparisonMedia(media, selection.photos, selection.logo), stamp: stamps.find(s => s.id === selection.stamp)};
}
