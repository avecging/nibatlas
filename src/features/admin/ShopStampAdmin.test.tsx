import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ShopStampAdmin } from './ShopStampAdmin';
import type { AdminStampVersion } from './stamp-contract';

const shopId='71000000-0000-4000-8000-000000000001';
const active:AdminStampVersion={id:'71000000-0000-4000-8000-000000000002',stampId:shopId,designVersion:1,
  kind:'generated_template',origin:'generated_template',status:'approved',ink:'teal',creatorName:null,creatorUrl:null,
  templateData:{tier:'shop',motif:'nib',template:'shop-seal-v1',shape:'oval'},hasArtwork:false,active:true,revision:'a'.repeat(32)};
beforeEach(()=>{Element.prototype.scrollIntoView=vi.fn();});
afterEach(()=>{cleanup();vi.restoreAllMocks();vi.unstubAllGlobals();});
it('randomises locally, permits a manual ink override, saves a private version and explicitly activates',async()=>{
  let entries=[active]; const calls:Record<string,unknown>[]=[];
  vi.stubGlobal('fetch',vi.fn(async(_url:string,options:RequestInit)=>{
    if(options.method==='POST'){
      const body=JSON.parse(String(options.body));calls.push(body);
      if(body.action==='create_generated') entries=[{...active,id:'71000000-0000-4000-8000-000000000003',designVersion:2,status:'draft',active:false,
        ink:body.ink,templateData:{tier:'shop',motif:'nib',template:'shop-seal-v1',shape:body.shape}},active];
      if(body.action==='activate') entries=entries.map(e=>({...e,status:'approved',active:e.id===body.versionId}));
    }
    return Response.json({entries});
  }));
  render(<ShopStampAdmin shopId={shopId} shopName="THINK FUNAN" countryCode="SG" archived={false}/>);
  await waitFor(()=>expect(screen.getByLabelText('Shape')).toHaveValue('oval'));
  const ink=screen.getByLabelText('Ink');expect(ink).toHaveValue('teal');
  fireEvent.click(screen.getByRole('button',{name:'Randomise shape and ink'}));
  expect(screen.getByLabelText('Shape')).not.toHaveValue('oval');expect(ink).not.toHaveValue('teal');expect(calls).toEqual([]);
  fireEvent.change(ink,{target:{value:'plum'}});
  const shape=(screen.getByLabelText('Shape') as HTMLSelectElement).value;
  fireEvent.click(screen.getByRole('button',{name:'Save default seal privately'}));
  await screen.findByText(/Default seal saved privately/);
  expect(calls).toEqual([{action:'create_generated',shape,ink:'plum',baseVersionId:active.id,baseRevision:active.revision}]);
  fireEvent.click(screen.getByRole('button',{name:'Reload stamps'}));await screen.findByText('Stamp versions reloaded.');
  expect(screen.getByText('Design v2')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:'Activate this design (admin)'}));expect(calls).toHaveLength(1);
  fireEvent.click(screen.getByRole('button',{name:'Confirm activation'}));
  await screen.findByText(/Stamp design activated/);expect(calls[1]?.action).toBe('activate');
  expect(screen.getByText('Design v1')).toBeInTheDocument();
});
it('hides randomisation for uploaded art and disables changes on archived shops',async()=>{
  vi.stubGlobal('fetch',vi.fn(async()=>Response.json({entries:[active]})));
  const {rerender}=render(<ShopStampAdmin shopId={shopId} shopName="THINK FUNAN" archived={false}/>);
  await waitFor(()=>expect(screen.getByLabelText('Stamp design')).toBeEnabled());
  fireEvent.change(screen.getByLabelText('Stamp design'),{target:{value:'uploaded'}});
  expect(screen.queryByRole('button',{name:'Randomise shape and ink'})).not.toBeInTheDocument();
  expect(screen.getByLabelText('Creator name (optional)')).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Stamp design'),{target:{value:'default'}});
  rerender(<ShopStampAdmin shopId={shopId} shopName="THINK FUNAN" archived/>);
  expect(screen.getByRole('button',{name:'Randomise shape and ink'})).toBeDisabled();
});
