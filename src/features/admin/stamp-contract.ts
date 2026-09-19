import { object, UUID } from './shop-contract';

export const STAMP_ORIGINS=['founder_created','ai_assisted','commissioned'] as const;
export const STAMP_INKS=['vermilion','navy','teal','indigo','plum','moss','ochre','brick'] as const;
export type StampOrigin=(typeof STAMP_ORIGINS)[number];
export type StampInk=(typeof STAMP_INKS)[number];
export interface AdminStampVersion {
  id:string; stampId:string; designVersion:number;
  kind:'generated_template'|'commissioned'|'uploaded';
  origin:'generated_template'|StampOrigin;
  status:'draft'|'approved'; ink:StampInk;
  creatorName:string|null; creatorUrl:string|null;
  hasArtwork:boolean; active:boolean; revision:string;
}
export function decodeAdminStamps(value:unknown):AdminStampVersion[] {
  if(!Array.isArray(value) || value.length>50) throw Error('Invalid stamp list');
  return value.map(item=>{
    const r=object(item);
    if(typeof r.id!=='string'||!UUID.test(r.id)||typeof r.stampId!=='string'||!UUID.test(r.stampId)
      ||typeof r.designVersion!=='number'||!Number.isInteger(r.designVersion)||r.designVersion<1
      ||!['generated_template','commissioned','uploaded'].includes(String(r.kind))
      ||!['generated_template',...STAMP_ORIGINS].includes(String(r.origin))
      ||!['draft','approved'].includes(String(r.status))||!STAMP_INKS.includes(r.ink as StampInk)
      ||!(r.creatorName===null||typeof r.creatorName==='string')
      ||!(r.creatorUrl===null||(typeof r.creatorUrl==='string'&&/^https?:\/\//i.test(r.creatorUrl)))
      ||typeof r.hasArtwork!=='boolean'||typeof r.active!=='boolean'
      ||typeof r.revision!=='string'||!/^[a-f0-9]{32}$/.test(r.revision)) throw Error('Invalid stamp version');
    return r as unknown as AdminStampVersion;
  });
}
export const stampAdminPath=(shopId:string)=>`/api/v1/admin/shops/${shopId}/stamp`;
