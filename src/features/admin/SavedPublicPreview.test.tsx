// @vitest-environment jsdom
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { SavedPublicPreview } from './SavedPublicPreview';
import { document } from './shop-contract';
const identity=vi.hoisted(()=>({session:{status:'signed-in',userId:'one'}}));
vi.mock('@/src/features/account/AccountSessionProvider',()=>({useAccountSession:()=>identity}));
vi.mock('@/src/components/shops/ShopDetailView',()=>({ShopDetailView:({shop,previewMedia}:{shop:{name:string};previewMedia:{altText:string}[]})=><div>{shop.name}{previewMedia.map(m=><p key={m.altText}>{m.altText}</p>)}</div>}));
const id='61000000-0000-4000-8000-000000000001',revision='a'.repeat(32),type='61000000-0000-4000-8000-000000000002';
const record={id,revision,publicationStatus:'draft',publicationErrors:[],hasChanges:true,document:document({shop:{name:'Saved synthetic',slug:'saved-synthetic',source_quality:'demo',operational_status:'unknown',position_precision:'street',country_code:'SG',timezone:'Asia/Singapore',latitude:0,longitude:0},sources:[],aliases:[],links:[],services:[],specialties:[],brands:[],types:[{shop_type_id:type,is_primary:true}]})};
const options={localities:[],types:[{id:type,code:'fountain_pen_specialist',label:'Specialist'}],services:[],specialties:[],brands:[]};
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
beforeEach(()=>{identity.session={status:'signed-in',userId:'one'};});
function install(overrides:{status?:number;revision?:string}={}) {
  const fetch=vi.fn(async(path:string)=>new Response(JSON.stringify(path.endsWith('/options')?options:path.endsWith('/media')?{entries:[{id:type,kind:'photo',width:2,height:2,altText:'Private photo',creditText:null,status:'draft',revision}]}:{...record,revision:overrides.revision??revision}),{status:overrides.status??200}));
  vi.stubGlobal('fetch',fetch);return fetch;
}
it.each([revision,'72000000-0000-4000-8000-000000000001'])('reads the exact saved revision %s with GET only and excludes private images',async(savedRevision)=>{
  const fetch=install({revision:savedRevision});render(<SavedPublicPreview id={id} revision={savedRevision}/>);
  expect(await screen.findByText('Saved synthetic')).toBeTruthy();expect(screen.queryByText('Private photo')).toBeNull();
  expect(fetch).toHaveBeenCalledTimes(3);
  for(const [,init] of fetch.mock.calls as unknown as [string,RequestInit][]) {expect(init.method).toBeUndefined();expect(init.cache).toBe('no-store');}
});
it('rejects stale revisions without displaying the newer content',async()=>{
  install({revision:'b'.repeat(32)});render(<SavedPublicPreview id={id} revision={revision}/>);
  expect(await screen.findByRole('alert')).toHaveTextContent('saved version has changed');expect(screen.queryByText('Saved synthetic')).toBeNull();
});
it('shows incomplete draft guidance without depending on media availability',async()=>{
  const fetch=vi.fn(async(path:string)=>{
    if(path.endsWith('/media')) throw Error('Media unavailable');
    return new Response(JSON.stringify(path.endsWith('/options')?options:{...record,document:{...record.document,shop:{...record.document.shop,name:'Incomplete saved draft',latitude:null,longitude:null,timezone:null}}}));
  });
  vi.stubGlobal('fetch',fetch);render(<SavedPublicPreview id={id} revision={revision}/>);
  expect(await screen.findByRole('region',{name:'Incomplete preview'})).toHaveTextContent('Incomplete saved draft');
  expect(fetch).toHaveBeenCalledTimes(2);
});
it('does not present a complete layout as accurate when its media cannot load',async()=>{
  const fetch=install();
  fetch.mockImplementation(async(path:string)=>path.endsWith('/media')?new Response(null,{status:503}):new Response(JSON.stringify(path.endsWith('/options')?options:record)));
  render(<SavedPublicPreview id={id} revision={revision}/>);
  expect(await screen.findByRole('alert')).toHaveTextContent('saved preview could not load');
  expect(screen.queryByText('Saved synthetic')).toBeNull();
});
it('denies ordinary accounts and drops loaded content when the session changes',async()=>{
  install();const view=render(<SavedPublicPreview id={id} revision={revision}/>);
  await screen.findByText('Saved synthetic');
  identity.session={status:'signed-out',userId:''};view.rerender(<SavedPublicPreview id={id} revision={revision}/>);
  expect(screen.queryByText('Saved synthetic')).toBeNull();
  install({status:403});identity.session={status:'signed-in',userId:'two'};view.rerender(<SavedPublicPreview id={id} revision={revision}/>);
  await waitFor(()=>expect(screen.getByRole('alert')).toHaveTextContent('current editor or admin access'));
  expect(screen.queryByText('Saved synthetic')).toBeNull();
});
