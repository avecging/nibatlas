/** Shared manual/import/public channel rules. Never fetch/expand an untrusted URL. */
export const SOCIAL_PLATFORMS = ['facebook', 'instagram', 'tiktok', 'xiaohongshu', 'threads', 'x', 'youtube'] as const;
export const CONTACT_PLATFORMS = ['whatsapp', 'telegram', 'line', 'wechat', 'messenger', 'kakaotalk'] as const;
export const PLATFORMS = [...SOCIAL_PLATFORMS, ...CONTACT_PLATFORMS];
export type Platform = typeof PLATFORMS[number];
export type ContactPlatform = typeof CONTACT_PLATFORMS[number];
export const PLATFORM_NAMES: Record<Platform, string> = { facebook:'Facebook', instagram:'Instagram', tiktok:'TikTok', xiaohongshu:'Xiaohongshu', threads:'Threads', x:'X', youtube:'YouTube', whatsapp:'WhatsApp', telegram:'Telegram', line:'LINE', wechat:'WeChat', messenger:'Messenger', kakaotalk:'KakaoTalk' };
export const PLATFORM_HINTS: Record<Platform, string> = {
  facebook:'Profile link or username', instagram:'Profile link or @username', tiktok:'Profile link or @username', xiaohongshu:'Profile/share link (a display name or RED ID cannot identify a profile URL)', threads:'Profile link or @username', x:'Profile link or @username', youtube:'Channel link or @handle',
  whatsapp:'Phone with +country code, or WhatsApp link. Local numbers are copied as entered.', telegram:'@username, phone with +country code, or Telegram link', line:'LINE ID or link. @official IDs support opening; personal IDs are copied.', wechat:'WeChat ID or shared link. IDs are copied.', messenger:'Username, page ID or Messenger link', kakaotalk:'KakaoTalk ID or channel/open-chat link. Bare IDs are copied.',
};
export const isPlatform = (v: unknown): v is Platform => typeof v === 'string' && PLATFORMS.includes(v as Platform);
export const isContactPlatform = (v: unknown): v is ContactPlatform => typeof v === 'string' && CONTACT_PLATFORMS.includes(v as ContactPlatform);
const hosts: Record<Platform, readonly string[]> = {
  facebook:['facebook.com','www.facebook.com','m.facebook.com','fb.com'], instagram:['instagram.com','www.instagram.com'], tiktok:['tiktok.com','www.tiktok.com','vm.tiktok.com','vt.tiktok.com'], xiaohongshu:['xiaohongshu.com','www.xiaohongshu.com','xhslink.com'], threads:['threads.net','www.threads.net','threads.com','www.threads.com'], x:['x.com','www.x.com','twitter.com','www.twitter.com'], youtube:['youtube.com','www.youtube.com','m.youtube.com','youtu.be'],
  whatsapp:['wa.me','api.whatsapp.com','web.whatsapp.com','chat.whatsapp.com'], telegram:['t.me','telegram.me','telegram.dog'], line:['line.me','www.line.me','lin.ee'], wechat:['weixin.qq.com','u.wechat.com','weixin110.qq.com'], messenger:['m.me','messenger.com','www.messenger.com','facebook.com','www.facebook.com'], kakaotalk:['pf.kakao.com','open.kakao.com'],
};
export function webUrl(value: string): URL | null {
  if (!/^https?:\/\/[^\s\\]+$/i.test(value) || /[\u0000-\u001f\u007f]/.test(value)) return null;
  try { const u = new URL(value); return u.hostname && !u.username && !u.password ? u : null; } catch { return null; }
}
function suppliedUrl(platform: Platform, value: string): string | null {
  // Domain shorthand is accepted only for known platform hosts, never guessed from IDs.
  const candidate = /^https?:\/\//i.test(value) ? value : hosts[platform].some(h => value.toLowerCase().startsWith(`${h}/`)) ? `https://${value}` : null;
  if (!candidate) return null;
  const u = webUrl(candidate);
  if (!u || !hosts[platform].includes(u.hostname.toLowerCase())) throw Error(`Use a ${PLATFORM_NAMES[platform]} link.`);
  return candidate;
}
export type ChannelValue = { url: string | null; account_value: string | null };
/** Contacts retain bare values separately; url remains a real supplied destination. */
export function normalizeChannel(platform: Platform, input: string): ChannelValue {
  const value = input.trim();
  if (!value || value.length > 4000 || /[\u0000-\u001f\u007f]/.test(value)) throw Error('Enter an account or link.');
  const url = suppliedUrl(platform, value);
  if (url) return {url, account_value:null};
  if (isContactPlatform(platform)) {
    if (value.length > 160) throw Error('Use at most 160 characters for an ID.');
    const phone = /^\+?[0-9][0-9 ().-]{3,30}$/.test(value);
    const id = /^@?[\p{L}\p{N}_.-]{1,160}$/u.test(value);
    if (platform === 'whatsapp' ? !phone : !(id || (platform === 'telegram' && phone))) throw Error(PLATFORM_HINTS[platform]);
    return {url:null, account_value:value};
  }
  const handle = value.replace(/^@/, '');
  if (platform === 'xiaohongshu') throw Error('Use the Xiaohongshu profile or share link; its public ID is not a profile URL.');
  // Derive only the supported handle subset; other scripts and unusual legacy
  // accounts can supply their real profile URL without guessing a destination.
  const pattern = platform === 'tiktok' ? /^[a-zA-Z0-9_.]{2,24}$/
    : platform === 'youtube' ? /^[a-zA-Z0-9][a-zA-Z0-9_.-]{1,28}[a-zA-Z0-9]$/
    : platform === 'x' ? /^[a-zA-Z0-9_]{1,15}$/
    : platform === 'instagram' || platform === 'threads' ? /^[a-zA-Z0-9_.]{1,30}$/
    : /^[\p{L}\p{N}_.-]{1,100}$/u;
  if (!pattern.test(handle) || platform === 'tiktok' && handle.endsWith('.'))
    throw Error(`Use a supported ${PLATFORM_NAMES[platform]} handle or paste the complete profile link.`);
  const prefix: Record<Exclude<typeof platform, 'xiaohongshu'>, string> = {facebook:'https://www.facebook.com/',instagram:'https://www.instagram.com/',tiktok:'https://www.tiktok.com/@',threads:'https://www.threads.com/@',x:'https://x.com/',youtube:'https://www.youtube.com/@'};
  return {url:prefix[platform] + encodeURIComponent(handle), account_value:null};
}
export interface ContactAction { copy: string; kind:'ID'|'Number'|'Link'; href?: string }
const international = (v: string) => /^\+[1-9]\d{5,14}$/.test(v.replace(/[ ().-]/g, '')) ? v.replace(/[ ().-]/g, '') : null;
const telegramReserved = new Set('addemoji addlist addstickers addstyle addtheme auction auth boost call confirmphone contact giftcode invoice joinchat login m nft proxy setlanguage share socks web a k z c s iv'.split(' '));
export function contactAction(platform: ContactPlatform, input: string): ContactAction {
  const url = suppliedUrl(platform, input);
  if (url) {
    const u = webUrl(url)!, path = u.pathname.replace(/\/$/, '');
    let id: string | undefined;
    let kind: ContactAction['kind'] = 'ID';
    if (platform === 'whatsapp') {
      const phone = u.hostname === 'wa.me' ? /^\/([1-9]\d{5,14})$/.exec(path)?.[1] : path === '/send' ? u.searchParams.get('phone') : null;
      if (phone && /^\+?[1-9]\d{5,14}$/.test(phone)) { id = `+${phone.replace(/^\+/, '')}`; kind = 'Number'; }
    } else if (platform === 'telegram') {
      const username = /^\/([a-zA-Z][a-zA-Z0-9_]{3,31})$/.exec(path)?.[1];
      if (username && !telegramReserved.has(username.toLowerCase())) id = `@${username}`;
      const phone = /^\/\+([1-9]\d{5,14})$/.exec(path)?.[1];
      if (phone) { id = `+${phone}`; kind = 'Number'; }
    } else if (platform === 'line' && u.hostname === 'line.me') {
      const raw = /^\/(?:R\/)?ti\/p\/([^/]+)$/.exec(path)?.[1] ?? /^\/R\/oaMessage\/([^/]+)$/.exec(path)?.[1];
      if (raw) { try { const decoded = decodeURIComponent(raw); if (/^@[a-zA-Z0-9_.-]+$/.test(decoded)) id = decoded; } catch { /* Opaque link: keep the original. */ } }
    } else if (platform === 'messenger') {
      if (u.hostname === 'm.me') id = /^\/([a-zA-Z0-9.]+)$/.exec(path)?.[1];
      else id = /^\/t\/([a-zA-Z0-9.]+)$/.exec(path)?.[1];
    }
    // LINE share tokens, WeChat QR tokens and Kakao channel tokens are NOT IDs.
    return {copy:id ?? url, kind:id ? kind : 'Link', href:url};
  }
  const value = input.trim();
  if (platform === 'whatsapp' || platform === 'telegram') {
    const phone = international(value);
    if (phone) return {copy:phone, kind:'Number', href:platform === 'whatsapp' ? `https://wa.me/${phone.slice(1)}` : `https://t.me/${phone}`};
    if (platform === 'whatsapp' || /^[+\d]/.test(value)) return {copy:value, kind:'Number'};
    const username = value.replace(/^@/, '');
    if (/^[a-zA-Z][a-zA-Z0-9_]{3,31}$/.test(username) && !telegramReserved.has(username.toLowerCase())) return {copy:`@${username}`,kind:'ID',href:`https://t.me/${username}`};
  }
  if (platform === 'line' && /^@[a-zA-Z0-9_.-]+$/.test(value)) return {copy:value,kind:'ID',href:`https://line.me/R/ti/p/${encodeURIComponent(value)}`};
  if (platform === 'messenger' && /^@?[a-zA-Z0-9.]+$/.test(value)) return {copy:value.replace(/^@/,''),kind:'ID',href:`https://m.me/${value.replace(/^@/,'')}`};
  return {copy:value,kind:'ID'};
}
