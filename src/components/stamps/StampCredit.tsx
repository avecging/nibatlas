import type { ShopStampDesign } from '@/src/domain/shop-detail';

export function StampCredit({stamp}:{stamp:ShopStampDesign}) {
  const name=stamp.uploaded?.creatorName ?? stamp.commissioned?.illustratorCredit;
  const url=stamp.uploaded?.creatorUrl ?? stamp.commissioned?.illustratorCreditUrl;
  if(!name) return null;
  return <p>created by: {url ? <a href={url} target="_blank" rel="noreferrer">{name}</a> : name}</p>;
}
