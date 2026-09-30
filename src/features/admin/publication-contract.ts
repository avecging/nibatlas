import { object, UUID } from './shop-contract';
export interface PublicationRequest { action: 'publish' | 'retry'; reviewId: string; }
export interface PublicationOutcome {
  kind: 'shop' | 'stamp' | 'photo' | 'logo'; targetId: string | null;
  status: 'pending' | 'succeeded' | 'failed'; reason: 'review_again' | 'requirements' | 'unavailable' | null;
}
export interface Publication {
  reviewId: string; status: 'complete' | 'partial' | 'failed'; outcomes: PublicationOutcome[];
  canRetry: boolean; updatedAt: string;
}
export function decodePublicationRequest(value: unknown): PublicationRequest {
  const r = object(value);
  if (Object.keys(r).sort().join(',') !== 'action,reviewId' || !['publish','retry'].includes(String(r.action))
    || typeof r.reviewId !== 'string' || !UUID.test(r.reviewId)) throw Error('Invalid publication request');
  return {action:r.action as PublicationRequest['action'],reviewId:r.reviewId};
}
export function decodePublication(value: unknown): {publication: Publication | null} {
  const outer = object(value);
  if (outer.publication === null) return {publication:null};
  const r = object(outer.publication);
  if (typeof r.reviewId !== 'string' || !UUID.test(r.reviewId) || !['complete','partial','failed'].includes(String(r.status))
    || typeof r.canRetry !== 'boolean' || typeof r.updatedAt !== 'string' || !Number.isFinite(Date.parse(r.updatedAt))
    || !Array.isArray(r.outcomes) || r.outcomes.length < 3 || r.outcomes.length > 53) throw Error('Invalid publication');
  const outcomes = r.outcomes.map(value => {
    const x = object(value);
    if (!['shop','stamp','photo','logo'].includes(String(x.kind))
      || !(x.targetId === null || typeof x.targetId === 'string' && UUID.test(x.targetId))
      || !['pending','succeeded','failed'].includes(String(x.status))
      || !(x.reason === null || ['review_again','requirements','unavailable'].includes(String(x.reason)))) throw Error('Invalid outcome');
    return {kind:x.kind,targetId:x.targetId,status:x.status,reason:x.reason} as PublicationOutcome;
  });
  return {publication:{reviewId:r.reviewId,status:r.status as Publication['status'],outcomes,canRetry:r.canRetry,updatedAt:r.updatedAt}};
}
export const publicationPath = (shop: string) => `/api/v1/admin/shops/${shop}/publication`;
