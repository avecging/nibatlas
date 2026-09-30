import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { ShopMessaging, ShopWebsiteSocial, mobileMessagingDevice } from './ShopChannels';
import type { ShopLink } from '@/src/domain/shop-detail';
Object.defineProperty(navigator,'clipboard',{configurable:true,get:()=>undefined});
const link=(type:string,value:string):ShopLink=>({type,label:type,isOfficial:true,...(value.startsWith('https:')?{url:value}:{accountValue:value})});
afterEach(()=>{vi.restoreAllMocks();});
it('desktop copies identifiers or the original opaque link, with accurate confirmation',async()=>{
  const writeText=vi.fn().mockResolvedValue(undefined);
  vi.spyOn(navigator,'clipboard','get').mockReturnValue({writeText} as unknown as Clipboard);
  render(<ShopMessaging links={[link('whatsapp','+6581234567'),link('line','https://lin.ee/token')]}/>);
  fireEvent.click(screen.getByRole('button',{name:'WhatsApp'}));
  await waitFor(()=>expect(screen.getByRole('status')).toHaveTextContent('Number copied'));
  expect(writeText).toHaveBeenLastCalledWith('+6581234567');
  fireEvent.click(screen.getByRole('button',{name:'LINE'}));
  await waitFor(()=>expect(screen.getByRole('status')).toHaveTextContent('Link copied'));
  expect(writeText).toHaveBeenLastCalledWith('https://lin.ee/token');
});
it('mobile WeChat IDs copy; a failed clipboard exposes a selectable value without claiming success',async()=>{
  vi.spyOn(navigator,'userAgent','get').mockReturnValue('Android');
  expect(mobileMessagingDevice()).toBe(true);
  vi.spyOn(navigator,'clipboard','get').mockReturnValue({writeText:vi.fn().mockRejectedValue(Error())} as unknown as Clipboard);
  render(<ShopMessaging links={[link('wechat','synthetic-shop')]}/>);
  fireEvent.click(screen.getByRole('button',{name:'WeChat'}));
  expect(await screen.findByRole('textbox',{name:'Contact to copy'})).toHaveValue('synthetic-shop');
  expect(screen.getByRole('status')).toHaveTextContent('Could not copy');
});
it('previews are inert and private links are excluded',()=>{
  render(<ShopMessaging inert links={[link('wechat','shop'),{...link('line','private'),isOfficial:false}]}/>);
  expect(screen.getByRole('button',{name:'WeChat'})).toBeDisabled();
  expect(screen.queryByRole('button',{name:'LINE'})).not.toBeInTheDocument();
});
it('orders website first, shows full URLs, excludes messaging and unsafe links; hides empty card',()=>{
  const {rerender}=render(<ShopWebsiteSocial links={[link('instagram','https://instagram.com/shop'),link('website','https://example.test'),link('wechat','shop'),{...link('website','bad'),url:'javascript:alert(1)'}]}/>);
  expect(screen.getAllByRole('link').map(el=>el.textContent)).toEqual(['https://example.test','https://instagram.com/shop']);
  rerender(<ShopWebsiteSocial links={[]}/>);
  expect(screen.queryByRole('heading')).not.toBeInTheDocument();
});
