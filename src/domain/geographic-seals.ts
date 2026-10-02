import { isShopId } from '@/src/api/v1/saved-shops';
import { isCountryCode, type CountryCode } from './geo';
import type { EarnedSeal } from './seals';
import type { ShopStampDesign } from './shop-detail';
import { STAMP_INKS, type StampInk } from './stamp-palette';
import {validCreatorCredit} from './creator-credit';
import type { SealTemplate } from './seal-template';
export function object(v: unknown): Record<string, unknown> {
 if (!v || typeof v !== 'object' || Array.isArray(v)) throw Error('Invalid seal');
 return v as Record<string, unknown>;
}
function text(v: unknown, max=300): string { if(typeof v !== 'string' || !v.trim() || v.length>max) throw Error('Invalid seal'); return v; }
export function uuid(v: unknown): string { const s=text(v,36); if(!isShopId(s)) throw Error('Invalid seal ID'); return s.toLowerCase(); }
export interface SealDocument {
 template?: SealTemplate;
 scope: 'country' | 'locality'; countryCode: CountryCode; countryLabel: string;
 localityId: string | null; ink: StampInk; eligibleShopIds: string[];
 artworkTreatment?: 'ink-v1';
 name?: string; origin?: 'generated'|'founder_created'|'ai_assisted'|'commissioned'|undefined;
 creatorName?: string|undefined; creatorUrl?: string|undefined; artworkId?: string|null;
}
export interface SealSnapshot extends SealDocument {
 localitySlug: string | null; localityName: string | null; template: SealTemplate;
 eligibleShops: {id:string;name:string}[];
}
export function sealDocument(v: unknown): SealDocument {
 const d=object(v), code=text(d.countryCode,2);
 if(!isCountryCode(code) || !['country','locality'].includes(String(d.scope)) || !STAMP_INKS.includes(d.ink as StampInk)) throw Error('Invalid seal');
 const scope=d.scope as SealDocument['scope'];
 if(d.template!==undefined && d.template!=='cartouche-v1' && d.template!=='cartouche-v2') throw Error('Invalid seal template');
 if(!Array.isArray(d.eligibleShopIds) || d.eligibleShopIds.length>(scope==='locality'?1:4)) throw Error('Invalid eligible set');
 const eligibleShopIds=d.eligibleShopIds.map(uuid);
 if(new Set(eligibleShopIds).size!==eligibleShopIds.length) throw Error('Duplicate eligible shop');
 if(scope==='country' && d.localityId!=null) throw Error('Unexpected locality');
 if(d.artworkTreatment!==undefined&&d.artworkTreatment!=='ink-v1')throw Error('Invalid artwork treatment');
 if(d.origin!==undefined && !['generated','founder_created','ai_assisted','commissioned'].includes(String(d.origin))) throw Error('Invalid origin');
 if(!validCreatorCredit(d.creatorName,d.creatorUrl)) throw Error('Invalid creator credit');
 return {scope,countryCode:code,countryLabel:text(d.countryLabel,100),localityId:scope==='locality'?uuid(d.localityId):null,ink:d.ink as StampInk,eligibleShopIds,
  ...(d.template!==undefined?{template:d.template as SealTemplate}:{}),
  ...(d.artworkTreatment==='ink-v1'?{artworkTreatment:'ink-v1' as const}:{}),
  ...(d.name!==undefined?{name:text(d.name,100)}:{}),...(d.origin!==undefined?{origin:d.origin as SealDocument['origin']}:{}),
  ...(d.creatorName!=null?{creatorName:d.creatorName as string}:{}),...(d.creatorUrl!=null?{creatorUrl:d.creatorUrl as string}:{}),
  ...(d.artworkId!==undefined?{artworkId:d.artworkId===null?null:uuid(d.artworkId)}:{})};
}
export function sealSnapshot(v: unknown): SealSnapshot {
 const d=object(v), base=sealDocument(v);
 if(!base.template || !Array.isArray(d.eligibleShops) || d.eligibleShops.length!==base.eligibleShopIds.length) throw Error('Invalid seal snapshot');
 const eligibleShops=d.eligibleShops.map(v=>{const r=object(v);return {id:uuid(r.id),name:text(r.name)};});
 if(new Set(eligibleShops.map(s=>s.id)).size!==eligibleShops.length || eligibleShops.some(s=>!base.eligibleShopIds.includes(s.id))) throw Error('Invalid membership');
 return {...base,template:base.template,localitySlug:base.scope==='locality'?text(d.localitySlug):null,localityName:base.scope==='locality'?text(d.localityName):null,eligibleShops};
}
export function sealDesign(id:string,s:SealDocument,version=1,localityName=''): ShopStampDesign {
 return {id,tier:s.scope,motif:'nib',ink:s.ink,localityLabel:localityName,countryLabel:s.countryLabel,designVersion:version,paletteVersion:1,generatedSealTemplate:s.template??'cartouche-v1',
  ...(s.artworkId?{sealArtwork:{id:s.artworkId,...(s.artworkTreatment?{treatment:s.artworkTreatment}:{}),...(s.creatorName?{creatorName:s.creatorName}:{}),...(s.creatorUrl?{creatorUrl:s.creatorUrl}:{})}}:{})};
}
export interface SealRow {
 id:string; published:boolean; current:SealSnapshot|null;
 progress:{count:number;collectedIds:string[];required?:number;eligibleTotal?:number}|null;
 award:(EarnedSeal & {unseen:boolean;awardId:string})|null;
}
export function sealRow(v:unknown): SealRow {
 const r=object(v), id=uuid(r.id);
 if(typeof r.published!=='boolean') throw Error('Invalid publication');
 const current=r.published?sealSnapshot(r.current):null;
 let progress:SealRow['progress']=null;
 if(current) { const t=object(r.progress); if(!Number.isSafeInteger(t.count) || (t.count as number)<0 || !Array.isArray(t.collectedIds) || t.collectedIds.length>4) throw Error('Invalid progress');progress={count:t.count as number,collectedIds:t.collectedIds.map(uuid)};
  if(t.required!==undefined) {if(!Number.isSafeInteger(t.required)||(t.required as number)<1||(t.required as number)>5||!Number.isSafeInteger(t.eligibleTotal)||(t.eligibleTotal as number)<0)throw Error('Invalid eligibility');progress.required=t.required as number;progress.eligibleTotal=t.eligibleTotal as number;}
 }
 let award:SealRow['award']=null;
 if(r.award!=null) {
  const a=object(r.award), s=sealSnapshot(a.snapshot);
  if(uuid(a.sealId)!==id || !Number.isSafeInteger(a.version) || (a.version as number)<1 || typeof a.unseen!=='boolean' || !/^\d{4}-\d{2}-\d{2}$/.test(text(a.earnedOn,10))) throw Error('Invalid award');
  award={id,...(s.name?{name:s.name}:{}),awardId:uuid(a.id),scope:s.scope,countryCode:s.countryCode,countryLabel:s.countryLabel,
   ...(s.localitySlug && s.localityName?{localitySlug:s.localitySlug,localityName:s.localityName}:{}),
   earnedOn:a.earnedOn as string,derivedFromShopId:uuid(a.shopId),coverageSetVersion:String(a.version),
   stamp:sealDesign(id,s,a.version as number,s.localityName??''),unseen:a.unseen};
 }
 return {id,published:r.published,current,progress,award};
}
export interface AdminSeal {id:string;revision:string;draft:SealDocument;published:boolean;publishedVersion:number|null;localityName:string|null}
export function adminSeal(v:unknown): AdminSeal {
 const r=object(v), d=object(r.draft);
 if(typeof r.published!=='boolean' || (r.published_version!==null && (!Number.isSafeInteger(r.published_version) || (r.published_version as number)<1))) throw Error('Invalid seal');
 return {id:uuid(r.id),revision:uuid(r.revision),draft:sealDocument(d),published:r.published,publishedVersion:r.published_version as number|null,localityName:typeof d.localityName==='string'?d.localityName:null};
}

/** Project only the validated published/owner fields; never forward provider additions. */
export function sealWire(v:unknown) {
 const raw=object(v), row=sealRow(v), a=raw.award==null?null:object(raw.award);
 return {id:row.id,published:row.published,current:row.current,progress:row.progress,award:a&&row.award?{
  id:row.award.awardId,sealId:row.id,version:row.award.stamp.designVersion,snapshot:sealSnapshot(a.snapshot),
  earnedOn:row.award.earnedOn,shopId:row.award.derivedFromShopId,unseen:row.award.unseen}:null};
}
