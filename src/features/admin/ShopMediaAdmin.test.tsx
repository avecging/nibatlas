import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { webcrypto } from 'node:crypto';
import { ShopMediaAdmin } from './ShopMediaAdmin';

vi.mock('./prepare-shop-image',()=>({prepareShopImage:vi.fn(async()=>({bytes:new ArrayBuffer(4),contentType:'image/png'}))}));
beforeEach(()=>vi.stubGlobal('crypto',webcrypto));
afterEach(()=>vi.unstubAllGlobals());
it('explains a failed media load and unlocks both pickers after a successful reload',async()=>{
  const fetch=vi.fn()
    .mockResolvedValueOnce(Response.json({error:{code:'media_busy'}},{status:503}))
    .mockResolvedValueOnce(Response.json({entries:[],capabilities:['remove','arrange']}));
  vi.stubGlobal('fetch',fetch);
  render(<ShopMediaAdmin shopId="73000000-0000-4000-8000-000000000001" shopName="Synthetic shop" published={false} archived={false} role="admin"/>);
  expect(await screen.findByRole('alert')).toHaveTextContent('request timed out');
  expect(screen.queryByText('Loading images…')).not.toBeInTheDocument();
  expect(screen.getByLabelText('Choose a photo')).toBeDisabled();
  expect(screen.getByLabelText('Choose a logo')).toBeDisabled();
  fireEvent.click(screen.getByRole('button',{name:'Reload images'}));
  await waitFor(()=>expect(screen.getByLabelText('Choose a photo')).toBeEnabled());
  expect(screen.getByLabelText('Choose a logo')).toBeEnabled();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(fetch.mock.calls.every(([,options])=>!options.method)).toBe(true);
});

function deferred<T>() {
  let resolve!:(value:T)=>void;
  const promise=new Promise<T>(done=>{resolve=done;});
  return {promise,resolve};
}

it.each([false,true])('runs photo/logo transfers together and preserves both attachments (first response fails: %s)',async(firstFails)=>{
  const photoId='73000000-0000-4000-8000-000000000010',logoId='73000000-0000-4000-8000-000000000011';
  const photoPut=deferred<Response>(),logoPut=deferred<Response>(),firstAttach=deferred<Response>(),secondAttach=deferred<Response>();
  const puts:string[]=[],finalized=new Set<string>(),attaches:string[]=[],initiated:string[]=[];
  const photo={id:photoId,kind:'photo',width:2,height:2,altText:'Synthetic photo',creditText:null,status:'draft',revision:'a'.repeat(32)};
  const logo={...photo,id:logoId,kind:'logo',altText:'Synthetic logo'};
  const gallery=(entries:unknown[])=>Response.json({entries,capabilities:['remove','arrange']});
  vi.stubGlobal('fetch',vi.fn(async(path:string,options:RequestInit={})=>{
    if(!options.method)return gallery([]);
    if(path.endsWith('/uploads')) {
      const id=JSON.parse(String(options.body)).purpose==='shop_photo'?photoId:logoId;
      initiated.push(id);return Response.json({id});
    }
    if(path.includes('/uploads/')) {
      const id=path.split('/').at(-1)!;
      if(options.method==='PUT') {puts.push(id);return id===photoId?photoPut.promise:logoPut.promise;}
      if(!puts.includes(id))return Response.json({error:{code:'upload_incomplete'}},{status:409});
      finalized.add(id);return Response.json({});
    }
    const {id,action}=JSON.parse(String(options.body));
    expect(action).toBe('attach');attaches.push(id);
    if(attaches.length===1)return firstAttach.promise;
    if(attaches.length===2)return secondAttach.promise;
    return gallery([photo,logo]);
  }));
  render(<ShopMediaAdmin shopId="73000000-0000-4000-8000-000000000001" shopName="Synthetic shop" published={false} archived={false} role="admin"/>);
  await waitFor(()=>expect(screen.getByLabelText('Choose a photo')).toBeEnabled());
  fireEvent.change(screen.getByLabelText('Choose a photo'),{target:{files:[new File(['photo'],'photo.png')]}});
  await waitFor(()=>expect(puts).toEqual([photoId]));
  expect(screen.getByLabelText('Choose a logo')).toBeEnabled();
  fireEvent.change(screen.getByLabelText('Choose a logo'),{target:{files:[new File(['logo'],'logo.png')]}});
  await waitFor(()=>expect(puts).toEqual([photoId,logoId]));
  expect(screen.getByRole('button',{name:'Reload images'})).toBeDisabled();
  await act(async()=>photoPut.resolve(Response.json({})));
  await waitFor(()=>expect(attaches).toEqual([photoId]));
  await act(async()=>logoPut.resolve(Response.json({})));
  await waitFor(()=>expect(finalized.has(logoId)).toBe(true));
  // A completed second transfer waits for the first attachment response, so
  // an older gallery snapshot cannot overwrite the newly attached logo.
  expect(attaches).toEqual([photoId]);
  await act(async()=>firstAttach.resolve(firstFails
    ? Response.json({error:{code:'media_busy'}},{status:503}) : gallery([photo])));
  await waitFor(()=>expect(attaches).toEqual([photoId,logoId]));
  expect(screen.getByRole('button',{name:'Reload images'})).toBeDisabled();
  if(!firstFails)expect(screen.getByRole('button',{name:'Show on public page'})).toBeDisabled();
  await act(async()=>secondAttach.resolve(gallery(firstFails?[logo]:[photo,logo])));
  await screen.findByText('logo.png · saved privately');
  if(firstFails) {
    expect(screen.getByText('photo.png · not saved')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button',{name:'Retry saving this photo'}));
  }
  await screen.findByText('photo.png · saved privately');
  expect(screen.getByAltText('Synthetic photo')).toBeInTheDocument();
  expect(screen.getByAltText('Synthetic logo')).toBeInTheDocument();
  expect(screen.getAllByText('Private to this draft')).toHaveLength(2);
  expect(initiated).toEqual([photoId,logoId]);
  expect(attaches).toEqual(firstFails?[photoId,logoId,photoId]:[photoId,logoId]);
  await waitFor(()=>expect(screen.getByRole('button',{name:'Reload images'})).toBeEnabled());
});
