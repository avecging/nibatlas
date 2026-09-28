import { decodeShop, object, UUID, type ShopRecord } from './shop-contract';
import { decodeShopMedia, type ShopMedia } from './media-contract';
import { decodeAdminStamps, type AdminStampVersion } from './stamp-contract';

export interface ReviewChoices { photos: string[]; logo: string | null; stamp: string | null; }
export interface SavedReview { id: string; choices: ReviewChoices; reviewedAt: string; current: boolean; }
export interface ReviewState {
  record: ShopRecord; media: ShopMedia[]; stamps: AdminStampVersion[];
  availableStampIds: string[]; reviewKey: string; conflict: boolean; review: SavedReview | null;
}
export interface ReviewSave { id: string; previousId: string | null; reviewKey: string; choices: ReviewChoices; }
const nullableId = (v: unknown) => v === null || typeof v === 'string' && UUID.test(v);
export function decodeReviewChoices(value: unknown): ReviewChoices {
  const r = object(value);
  if (Object.keys(r).sort().join(',') !== 'logo,photos,stamp' || !Array.isArray(r.photos) || r.photos.length > 50
    || r.photos.some(id => typeof id !== 'string' || !UUID.test(id)) || new Set(r.photos).size !== r.photos.length
    || !nullableId(r.logo) || !nullableId(r.stamp)) throw Error('Invalid review choices');
  return {photos:[...r.photos] as string[], logo:r.logo as string|null, stamp:r.stamp as string|null};
}
export function decodeReviewSave(value: unknown): ReviewSave {
  const r = object(value);
  if (Object.keys(r).sort().join(',') !== 'choices,id,previousId,reviewKey'
    || typeof r.id !== 'string' || !UUID.test(r.id) || !nullableId(r.previousId)
    || typeof r.reviewKey !== 'string' || !/^[a-f0-9]{64}$/.test(r.reviewKey)) throw Error('Invalid review request');
  return {id:r.id, previousId:r.previousId as string|null, reviewKey:r.reviewKey, choices:decodeReviewChoices(r.choices)};
}
export function decodeReviewState(value: unknown): ReviewState {
  const r = object(value);
  if (!Array.isArray(r.availableStampIds) || r.availableStampIds.length > 50 || r.availableStampIds.some(id => typeof id !== 'string' || !UUID.test(id))
    || typeof r.reviewKey !== 'string' || !/^[a-f0-9]{64}$/.test(r.reviewKey) || typeof r.conflict !== 'boolean') throw Error('Invalid review state');
  let review: SavedReview | null = null;
  if (r.review !== null) {
    const s = object(r.review);
    if (typeof s.id !== 'string' || !UUID.test(s.id) || typeof s.current !== 'boolean'
      || typeof s.reviewedAt !== 'string' || !Number.isFinite(Date.parse(s.reviewedAt))) throw Error('Invalid saved review');
    review = {id:s.id, choices:decodeReviewChoices(s.choices), reviewedAt:s.reviewedAt, current:s.current};
  }
  return {record:decodeShop(r.record), media:decodeShopMedia(r.media,true), stamps:decodeAdminStamps(r.stamps).map(s => ({
      id:s.id,stampId:s.stampId,designVersion:s.designVersion,kind:s.kind,origin:s.origin,status:s.status,
      ink:s.ink,creatorName:s.creatorName,creatorUrl:s.creatorUrl,hasArtwork:s.hasArtwork,active:s.active,revision:s.revision,
      ...(s.templateData === undefined ? {} : {templateData:s.templateData === null ? null : {tier:s.templateData.tier,motif:s.templateData.motif}}),
    })),
    availableStampIds:[...r.availableStampIds] as string[], reviewKey:r.reviewKey, conflict:r.conflict, review};
}
export const reviewPath = (id: string) => `/api/v1/admin/shops/${id}/review`;
