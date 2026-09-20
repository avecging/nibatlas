import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { ShopMediaGallery } from './ShopMediaGallery';
import { ShopIdentityHero } from './ShopIdentityHero';
import { prototypeShopDetails } from '@/src/fixtures/prototype-catalogue';
const shop='73000000-0000-4000-8000-000000000001',id='73000000-0000-4000-8000-000000000002';
afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs();});
it('renders full public image with existing credit from publication-checked URL',async()=>{
  vi.stubGlobal('fetch',vi.fn(async()=>Response.json({entries:[{id,kind:'photo',width:600,height:400,altText:'Photo of Demo',creditText:'Existing photographer'}]})));
  render(<ShopMediaGallery shopId={shop}/>);
  expect(await screen.findByAltText('Photo of Demo')).toHaveAttribute('src',`/api/v1/shops/${shop}/media/${id}`);
  expect(screen.getByText('Existing photographer')).toBeInTheDocument();
});
it('allows recovery without inventing images on a failed public list',async()=>{
  vi.stubGlobal('fetch',vi.fn().mockResolvedValueOnce(new Response('',{status:503})).mockResolvedValueOnce(Response.json({entries:[]})));
  render(<ShopMediaGallery shopId={shop}/>);
  fireEvent.click(await screen.findByRole('button',{name:'Retry images'}));
  expect(fetch).toHaveBeenCalledTimes(2);
});
it('does not claim photos are coming soon in live catalogue mode',()=>{
  vi.stubEnv('NEXT_PUBLIC_CATALOGUE_MODE','api-demo');
  render(<ShopIdentityHero shop={prototypeShopDetails[0]!}/>);
  expect(screen.queryByText('Photos coming soon')).not.toBeInTheDocument();
});

it('preserves published photo order and renders Unicode captions as text separately from credit',async()=>{
  const caption='墨水 <script>window.__captionExecuted=true</script>';
  vi.stubGlobal('fetch',vi.fn(async()=>Response.json({entries:[
    {id:'84000000-0000-4000-8000-000000000002',kind:'photo',width:2,height:2,altText:'Cover',creditText:'Photographer',caption,sortOrder:0},
    {id:'84000000-0000-4000-8000-000000000001',kind:'photo',width:2,height:2,altText:'Second photo',creditText:null,caption:null,sortOrder:1},
  ]})));
  const {container}=render(<ShopMediaGallery shopId="84000000-0000-4000-8000-000000000003"/>);
  expect(await screen.findByText(caption)).toBeInTheDocument();
  expect(screen.getByText('Photographer')).toBeInTheDocument();
  expect(screen.getAllByRole('img').map(e=>e.getAttribute('alt'))).toEqual(['Cover','Second photo']);
  expect(container.querySelector('script')).toBeNull();
});
