import { decodeShop, type ShopRecord } from './shop-contract';
import { decodeShopMedia, mediaPath, type ShopMedia } from './media-contract';
import { decodeAdminStamps, stampAdminPath, type AdminStampVersion } from './stamp-contract';

export interface MediaReviewSnapshot {
  record: ShopRecord;
  fingerprint: string;
  media: ShopMedia[];
  stamps: AdminStampVersion[];
}

export class MediaReviewFailure extends Error {}

/** Read-only comparison, never a publication token or an atomic database snapshot. */
export async function readMediaReview(record: Pick<ShopRecord, 'id' | 'revision'>, signal: AbortSignal): Promise<MediaReviewSnapshot> {
  const read = async (path: string) => {
    const response = await fetch(path, {signal, cache:'no-store', credentials:'same-origin'});
    if (!response.ok) throw new MediaReviewFailure(response.status === 401 || response.status === 403
      ? 'Sign in with current editor or admin access to review saved images and artwork.'
      : 'Saved images and artwork could not load. Try loading them again.');
    return response.json();
  };
  const checkShop = async () => {
    const saved = decodeShop(await read(`/api/v1/admin/shops/${record.id}`));
    if (saved.id !== record.id || saved.revision !== record.revision) throw new MediaReviewFailure(
      'The saved shop has changed. Reload the saved version in the editor before comparing images and artwork.');
    return saved;
  };
  const saved = await checkShop();
  const [media, stamps] = await Promise.all([read(mediaPath(record.id)), read(stampAdminPath(record.id))]);
  const snapshot = {media:decodeShopMedia(media.entries, true), stamps:decodeAdminStamps(stamps.entries)};
  // Catch a catalogue edit during the separate media reads. Media revisions remain
  // independent snapshots; no mutation can consume these temporary choices.
  await checkShop();
  return {...snapshot, record:saved, fingerprint:await mediaReviewFingerprint(snapshot)};
}

export function comparisonMedia(entries: readonly ShopMedia[], photoIds: readonly string[], logoId: string | null): ShopMedia[] {
  return entries.filter(entry => entry.status !== 'rejected' && (entry.kind === 'logo'
    ? entry.id === logoId
    : entry.status === 'approved' || photoIds.includes(entry.id)));
}

/** Canonical scalar arrays bind displayed metadata, membership, order and active
 * artwork as well as opaque revisions. This is a freshness check, not authority. */
export async function mediaReviewFingerprint({media, stamps}: Pick<MediaReviewSnapshot, 'media' | 'stamps'>): Promise<string> {
  if (new Set(media.map(m => m.id)).size !== media.length || new Set(stamps.map(s => s.id)).size !== stamps.length)
    throw new MediaReviewFailure('Saved images and artwork could not load. Try loading them again.');
  const value = JSON.stringify([
    media.map(m => [m.id,m.revision,m.kind,m.status,m.width,m.height,m.altText,m.creditText,m.sortOrder ?? null,m.caption ?? null]),
    stamps.map(s => [s.id,s.revision,s.stampId,s.designVersion,s.kind,s.origin,s.status,s.active,s.hasArtwork,s.ink,s.creatorName,s.creatorUrl,s.templateData?.tier ?? null,s.templateData?.motif ?? null]),
  ]);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}
