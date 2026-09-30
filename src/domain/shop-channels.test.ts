import { describe, expect, it } from 'vitest';
import { contactAction, normalizeChannel, type Platform } from './shop-channels';
describe('supported profiles',()=>{
  it.each([
    ['facebook','shop.name','https://www.facebook.com/shop.name'],['instagram','@shop.name','https://www.instagram.com/shop.name'],['tiktok','@shopname','https://www.tiktok.com/@shopname'],['threads','@shopname','https://www.threads.com/@shopname'],['x','@shopname','https://x.com/shopname'],['youtube','@shopname','https://www.youtube.com/@shopname'],
  ] as const)('normalizes %s handles without guessing a different identity',(p,input,url)=>expect(normalizeChannel(p,input)).toEqual({url,account_value:null}));
  it('preserves explicit legacy and short URLs, but never derives a RED URL from a public ID',()=>{
    for(const url of ['https://www.xiaohongshu.com/user/profile/abc?xsec_token=secret','http://xhslink.com/a/token']) expect(normalizeChannel('xiaohongshu',url).url).toBe(url);
    expect(()=>normalizeChannel('xiaohongshu','myshop123')).toThrow(/profile or share link/);
    expect(normalizeChannel('instagram','www.instagram.com/shopname').url).toBe('https://www.instagram.com/shopname');
  });
  it.each(['javascript:alert(1)','https://instagram.com.evil.test/shop','https://u:p@instagram.com/shop','https://instagram.com\\@evil.test/shop','https://instagram.com/\nshop'])('rejects unsafe social destination %s',v=>expect(()=>normalizeChannel('instagram',v)).toThrow());
  it.each(['https://evil.test/a','tg://resolve?domain=shop','javascript:alert(1)'])('rejects unsupported contact input %s',v=>expect(()=>normalizeChannel('telegram',v)).toThrow());
});
describe('messaging destinations and honest clipboard payloads',()=>{
  it.each([
    ['whatsapp','+65 8123 4567','+6581234567','Number','https://wa.me/6581234567'],
    ['whatsapp','8123 4567','8123 4567','Number',undefined],
    ['whatsapp','https://wa.me/6581234567?text=Hello','+6581234567','Number','https://wa.me/6581234567?text=Hello'],
    ['telegram','@shopname','@shopname','ID','https://t.me/shopname'],
    ['telegram','https://t.me/shopname','@shopname','ID','https://t.me/shopname'],
    ['telegram','+65 8123 4567','+6581234567','Number','https://t.me/+6581234567'],
    ['line','@shopname','@shopname','ID','https://line.me/R/ti/p/%40shopname'],
    ['line','personal.id','personal.id','ID',undefined],
    ['line','https://line.me/R/ti/p/%40shopname','@shopname','ID','https://line.me/R/ti/p/%40shopname'],
    ['wechat','shopname','shopname','ID',undefined],
    ['messenger','shopname','shopname','ID','https://m.me/shopname'],
    ['messenger','https://m.me/123456789','123456789','ID','https://m.me/123456789'],
    ['kakaotalk','shopname','shopname','ID',undefined],
  ] as const)('%s %s resolves conservatively',(p,v,copy,kind,href)=>expect(contactAction(p,v)).toEqual({copy,kind,...(href?{href}:{})}));
  it.each([
    ['whatsapp','https://wa.me/message/ABC123'],['telegram','https://t.me/contact/abc123'],['telegram','https://t.me/+invite-token'],['line','https://lin.ee/abc123'],['line','https://line.me/ti/p/abc123'],['wechat','https://u.wechat.com/abc123'],['kakaotalk','https://pf.kakao.com/_abc123/chat'],['kakaotalk','https://open.kakao.com/o/abc123'],['messenger','https://m.me/join/abc123'],
  ] as const)('keeps %s tokens as links', (p,url)=>expect(contactAction(p,url)).toEqual({copy:url,kind:'Link',href:url}));
  it('does not guess country codes, LINE official status or Kakao channel IDs',()=>{
    for (const platform of ['whatsapp','line','wechat','kakaotalk'] as const) expect(contactAction(platform,'81234567').href).toBeUndefined();
  });
  it.each(['whatsapp','telegram','line','wechat','messenger','kakaotalk'] as Platform[])('stores a bare contact separately from a URL: %s',p=>expect(normalizeChannel(p,p==='whatsapp'?'+65 8123 4567':'shopname')).toMatchObject({url:null}));
});
