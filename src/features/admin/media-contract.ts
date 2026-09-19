import { object, UUID } from './shop-contract';
export interface ShopMedia {
  id: string; kind: 'photo' | 'logo'; width: number; height: number;
  altText: string; creditText: string | null;
  status?: 'draft' | 'approved' | 'rejected'; revision?: string;
}
export function decodeShopMedia(value: unknown, admin = false): ShopMedia[] {
  if (!Array.isArray(value) || value.length > 50) throw Error('Invalid media list');
  return value.map(item => {
    const r = object(item);
    if (typeof r.id !== 'string' || !UUID.test(r.id) || !['photo','logo'].includes(String(r.kind)) ||
      [r.width,r.height].some(n => typeof n !== 'number' || !Number.isInteger(n) || n < 1 || n > 2048) ||
      typeof r.altText !== 'string' || !r.altText.trim() ||
      !(r.creditText === null || typeof r.creditText === 'string') ||
      (admin && (!['draft','approved','rejected'].includes(String(r.status)) || typeof r.revision !== 'string' || !/^[a-f0-9]{32}$/.test(r.revision)))) throw Error('Invalid media item');
    return {id:r.id,kind:r.kind as ShopMedia['kind'],width:r.width as number,height:r.height as number,
      altText:r.altText,creditText:r.creditText as string|null,
      ...(admin ? {status:r.status as NonNullable<ShopMedia['status']>,revision:r.revision as string} : {})};
  });
}
export const mediaPath = (shopId: string, admin = true) => `/api/v1/${admin ? 'admin/' : ''}shops/${shopId}/media`;
