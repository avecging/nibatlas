import type { ShopStampDesign } from '@/src/domain/shop-detail';

export function StampCredit({stamp}:{stamp:ShopStampDesign}) {
  const name=stamp.uploaded?.creatorName ?? stamp.commissioned?.illustratorCredit;
  const url=stamp.uploaded?.creatorUrl ?? stamp.commissioned?.illustratorCreditUrl;
  const safeUrl=typeof url==='string' && /^https?:\/\//i.test(url) ? url : undefined;
  if(!name) return null;
  return <p>created by: {safeUrl ? <a href={safeUrl} target="_blank" rel="noreferrer">{name}</a> : name}</p>;
}
