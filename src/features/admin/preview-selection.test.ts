import { expect, it } from 'vitest';
import { mediaReviewFingerprint, type MediaReviewSnapshot } from './media-review';
import { decodePreviewSelection, resolvePreviewSelection, type PreviewSelection } from './preview-selection';
import { document } from './shop-contract';
import type { ShopMedia } from './media-contract';
import type { AdminStampVersion } from './stamp-contract';
const uuid = (n:number) => `61000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const revision = 'a'.repeat(32);
const media: ShopMedia[] = [1,2,3,4].map(n => ({id:uuid(n),kind:n > 2 ? 'logo' : 'photo',width:12,height:8,altText:`Synthetic ${n}`,creditText:null,status:n % 2 ? 'approved' : 'draft',revision,sortOrder:n,caption:`Caption ${n}`}));
const stamps: AdminStampVersion[] = [5,6,7].map(n => ({id:uuid(n),stampId:uuid(8),designVersion:n,kind:'uploaded',origin:'founder_created',status:n===6?'draft':'approved',ink:'teal',creatorName:'Synthetic Artist',creatorUrl:'https://example.test/artist',hasArtwork:true,active:n===5,revision}));
async function fixture() {
  const snapshot: MediaReviewSnapshot = {record:{id:uuid(9),revision,publicationStatus:'draft',hasChanges:true,publicationErrors:[],document:document({shop:{name:'Synthetic',slug:'synthetic',source_quality:'demo',operational_status:'unknown',position_precision:'street'},sources:[],aliases:[],links:[],services:[],specialties:[],brands:[],types:[]})},media:structuredClone(media),stamps:structuredClone(stamps),fingerprint:await mediaReviewFingerprint({media,stamps})};
  const selection: PreviewSelection = {shopId:uuid(9),revision,fingerprint:snapshot.fingerprint,photos:[uuid(2)],logo:uuid(4),stamp:uuid(6)};
  return {snapshot,selection};
}
it('resolves only current eligible selected media in saved order and the exact credited stamp',async()=>{
  const {snapshot,selection} = await fixture();
  const result = resolvePreviewSelection(snapshot,decodePreviewSelection(selection));
  expect(result.media.map(m=>m.id)).toEqual([uuid(1),uuid(2),uuid(4)]);
  expect(result.stamp).toBe(snapshot.stamps[1]!);
  expect(resolvePreviewSelection(snapshot,{...selection,photos:[],logo:null,stamp:null})).toEqual({media:[snapshot.media[0]!],stamp:undefined});
});
it.each([
  {photos:[uuid(2),uuid(2)]},{photos:Array(51).fill(uuid(2))},{photos:['bad']},{photos:'bad'},
  {logo:'https://example.test/image'},{stamp:''},{fingerprint:revision},{shopId:'bad'},
  {revision:'bad'},{unknown:true},
])('rejects malformed selection %j',async patch=>{
  const {selection}=await fixture();expect(()=>decodePreviewSelection({...selection,...patch})).toThrow('Invalid preview');
});
it.each([{photos:[uuid(4)]},{photos:[uuid(20)]},{logo:uuid(2)},{stamp:uuid(7)},{stamp:uuid(20)}])('rejects unavailable or wrong-kind choices %j',async patch=>{
  const {snapshot,selection}=await fixture();expect(()=>resolvePreviewSelection(snapshot,{...selection,...patch})).toThrow('unavailable');
});
it.each(['revision','membership','order','caption','status','active stamp','credit','artwork','template'])( 'detects changed %s before rendering',async kind=>{
  const {snapshot,selection}=await fixture();
  if(kind==='revision') snapshot.media[0]!.revision='b'.repeat(32);
  if(kind==='membership') snapshot.media.pop();
  if(kind==='order') snapshot.media.reverse();
  if(kind==='caption') snapshot.media[0]!.caption='New caption';
  if(kind==='status') snapshot.media[0]!.status='draft';
  if(kind==='active stamp') snapshot.stamps[0]!.active=false;
  if(kind==='credit') snapshot.stamps[1]!.creatorName='New artist';
  if(kind==='artwork') snapshot.stamps[1]!.hasArtwork=false;
  if(kind==='template') {snapshot.stamps[0]!.kind='generated_template';snapshot.stamps[0]!.templateData={tier:'shop',motif:'nib'};}
  snapshot.fingerprint=await mediaReviewFingerprint(snapshot);
  expect(()=>resolvePreviewSelection(snapshot,selection)).toThrow('have changed');
});
it('rejects shop/revision mismatches and ambiguous duplicate identities',async()=>{
  const {snapshot,selection}=await fixture();
  for(const patch of [{shopId:uuid(10)},{revision:'b'.repeat(32)}]) expect(()=>resolvePreviewSelection(snapshot,{...selection,...patch})).toThrow('have changed');
  await expect(mediaReviewFingerprint({...snapshot,media:[...snapshot.media,snapshot.media[0]!]})).rejects.toThrow();
  await expect(mediaReviewFingerprint({...snapshot,stamps:[...snapshot.stamps,snapshot.stamps[0]!]})).rejects.toThrow();
});
it('canonicalizes JSON key order without ignoring display metadata',async()=>{
  expect(await mediaReviewFingerprint({media,stamps})).toBe(await mediaReviewFingerprint({media:media.map(m=>Object.fromEntries(Object.entries(m).reverse()) as unknown as ShopMedia),stamps:stamps.map(s=>Object.fromEntries(Object.entries(s).reverse()) as unknown as AdminStampVersion)}));
});
