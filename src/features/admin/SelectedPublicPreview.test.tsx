// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { SavedPublicPreview } from './SavedPublicPreview';
import { document } from './shop-contract';
import { mediaReviewFingerprint } from './media-review';
import type { PreviewSelection } from './preview-selection';
import type { ShopMedia } from './media-contract';
import type { AdminStampVersion } from './stamp-contract';
const identity=vi.hoisted(()=>({session:{status:'signed-in',userId:'one'}}));
const intent=vi.hoisted(()=>({value:null as PreviewSelection|null}));
vi.mock('@/src/features/account/AccountSessionProvider',()=>({useAccountSession:()=>identity}));
// Message source/origin and payload validation are covered separately; exercise
// the real authenticated read/projection/selection flow after the handshake.
vi.mock('./SelectedPreviewReceiver',()=>({SelectedPreviewReceiver:({children}:{children:(s:PreviewSelection)=>ReactNode})=>children(intent.value!)}));
vi.mock('@/src/components/shops/ShopDetailView',()=>({ShopDetailView:({shop,previewMedia}:{shop:{name:string};previewMedia:ShopMedia[]})=><div>{shop.name}{previewMedia.map(m=><p key={m.id}>{m.altText} {m.caption}</p>)}</div>}));
const uuid=(n:number)=>`61000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const id=uuid(1),revision='a'.repeat(32),type=uuid(2);
const record={id,revision,publicationStatus:'draft',publicationErrors:[],hasChanges:true,document:document({shop:{name:'Saved synthetic',slug:'saved-synthetic',source_quality:'demo',operational_status:'unknown',position_precision:'street',country_code:'SG',timezone:'Asia/Singapore',latitude:0,longitude:0,internal_notes:'PRIVATE NOTE'},sources:[],aliases:[],links:[],services:[],specialties:[],brands:[],types:[{shop_type_id:type,is_primary:true}]})};
const options={localities:[],types:[{id:type,code:'fountain_pen_specialist',label:'Specialist'}],services:[],specialties:[],brands:[]};
const media:ShopMedia[]=[{id:uuid(3),kind:'photo',width:12,height:8,altText:'Selected private photo',caption:'Saved caption',creditText:null,status:'draft',revision},{id:uuid(4),kind:'logo',width:12,height:8,altText:'Replacement logo',creditText:null,status:'draft',revision}];
const stamps:AdminStampVersion[]=[{id:uuid(5),stampId:uuid(6),designVersion:2,kind:'uploaded',origin:'commissioned',status:'draft',active:false,hasArtwork:true,ink:'teal',creatorName:'Synthetic Artist',creatorUrl:'https://example.test/artist',revision}];
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
beforeEach(async()=>{
  identity.session={status:'signed-in',userId:'one'};
  intent.value={shopId:id,revision,fingerprint:await mediaReviewFingerprint({media,stamps}),photos:[uuid(3)],logo:uuid(4),stamp:uuid(5)};
});
function install({changed=false,denied='',newShop=false}:{changed?:boolean;denied?:string;newShop?:boolean}={}) {
  const fetch=vi.fn(async(path:string)=>{
    if(denied && path.endsWith(denied)) return new Response(null,{status:403});
    return new Response(JSON.stringify(path.endsWith('/options')?options:path.endsWith('/media')?{entries:changed?media.map(m=>({...m,caption:'Concurrent caption'})):media}:path.endsWith('/stamp')?{entries:stamps}:{...record,revision:newShop?'b'.repeat(32):revision}));
  });vi.stubGlobal('fetch',fetch);return fetch;
}
it('rereads authorized saved content and renders the selected private media and exact credited stamp using GET only',async()=>{
  const fetch=install();render(<SavedPublicPreview id={id} revision={revision} selected/>);
  await screen.findByText('Selected private photo Saved caption');expect(screen.getByText('Replacement logo')).toBeTruthy();
  expect(screen.getByRole('link',{name:'Synthetic Artist'})).toHaveAttribute('href','https://example.test/artist');
  for(const image of screen.getAllByRole('img')) expect(image).toHaveAttribute('src',`/api/v1/admin/shops/${id}/stamp/${uuid(5)}`);
  expect(screen.queryByText('PRIVATE NOTE')).toBeNull();expect(fetch).toHaveBeenCalledTimes(5);
  for(const [,init] of fetch.mock.calls as unknown as [string,RequestInit][]) {expect(init.method).toBeUndefined();expect(init.cache).toBe('no-store');expect(init.credentials).toBe('same-origin');}
});
it.each([{changed:true},{newShop:true},{denied:'/stamp'},{denied:'/media'},{denied:'/options'}])('withholds the whole selected view for stale/denied reads %j',async overrides=>{
  install(overrides);render(<SavedPublicPreview id={id} revision={revision} selected/>);
  await screen.findByRole('alert');expect(screen.queryByText('Saved synthetic')).toBeNull();expect(screen.queryByRole('img')).toBeNull();
});
it('drops all selected private content on sign-out and a different denied account',async()=>{
  install();const view=render(<SavedPublicPreview id={id} revision={revision} selected/>);
  await screen.findByText('Saved synthetic');identity.session={status:'signed-out',userId:''};view.rerender(<SavedPublicPreview id={id} revision={revision} selected/>);
  expect(screen.queryByText('Saved synthetic')).toBeNull();expect(screen.queryByRole('img')).toBeNull();
  install({denied:'/stamp'});identity.session={status:'signed-in',userId:'two'};view.rerender(<SavedPublicPreview id={id} revision={revision} selected/>);
  expect(screen.queryByText('Saved synthetic')).toBeNull();await waitFor(()=>expect(screen.getByRole('alert')).toHaveTextContent('current editor or admin access'));
});
