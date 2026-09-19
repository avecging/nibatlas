import { isShopId } from '@/src/api/v1/saved-shops';
import { STAMP_FAILURE_STATUS, type StampFailureCode, type StampResponseV1 } from '@/src/api/v1/stamp-verification';
import type { StampCollection } from '@/src/domain/passport';
import type { StampMotif, ShopStampDesign } from '@/src/domain/shop-detail';
import { STAMP_INK_LABELS } from '@/src/domain/stamp-palette';

export function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid response');
  return value as Record<string, unknown>;
}
function string(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error('Invalid response');
  return value;
}
function id(value: unknown): string {
  const result = string(value);
  if (!isShopId(result)) throw new Error('Invalid response');
  return result;
}
const MOTIFS = ['storefront','shophouse','ink-bottle','nib','arcade','harbour','counter','workbench'];

/** Historical fields are read only from the issued snapshot, never today's catalogue. */
export function decodeCollection(input: unknown, currentShopSlug = ''): StampCollection {
  const c = record(input), place = record(c['place']), art = record(c['stamp']);
  const collectedAt = string(c['collectedAt']), timezone = string(c['shopTimezone']);
  if (!Number.isFinite(Date.parse(collectedAt))) throw new Error('Invalid response');
  const countryCode = string(place['countryCode']);
  if (!/^[A-Z]{2}$/.test(countryCode)) throw new Error('Invalid response');
  const countryLabel = string(place['countryLabel']), localityName = string(place['localityName']);
  const localitySlug = string(place['localitySlug']);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(localitySlug)) throw new Error('Invalid response');
  const stampId = id(c['stampId']);
  if (art['id'] !== stampId || !Number.isInteger(art['designVersion']) || Number(art['designVersion']) < 1
    || art['paletteVersion'] !== 1 || !Object.hasOwn(STAMP_INK_LABELS, string(art['ink']))) throw new Error('Invalid response');
  let commissioned: ShopStampDesign['commissioned'];
  let uploaded: ShopStampDesign['uploaded'];
  let motif: StampMotif = 'storefront';
  if (art['artworkKind'] === 'generated_template') {
    const template = record(art['templateData']);
    if (template['tier'] !== 'shop' || !MOTIFS.includes(string(template['motif']))) throw new Error('Invalid response');
    motif = template['motif'] as StampMotif;
  } else if (art['artworkKind'] === 'commissioned') {
    const creditUrl = art['illustratorCreditUrl'];
    if (creditUrl !== null && creditUrl !== undefined &&
      (typeof creditUrl !== 'string' || !/^https?:\/\//i.test(creditUrl))) throw new Error('Invalid response');
    commissioned = {
      illustratorCredit: string(art['illustratorCredit']),
      ...(typeof creditUrl === 'string' ? { illustratorCreditUrl: creditUrl } : {}),
      cleanSvgKey: string(art['cleanSvgKey']), cleanSvgSha256: string(art['cleanSvgSha256']),
      outlinedSvgKey: string(art['outlinedSvgKey']), outlinedSvgSha256: string(art['outlinedSvgSha256']),
      transparentPngKey: string(art['transparentPngKey']), transparentPngSha256: string(art['transparentPngSha256']),
    };
  } else if (art['artworkKind'] === 'uploaded') {
    const origin=string(art['artworkOrigin']);
    if (!['founder_created','ai_assisted','commissioned'].includes(origin)) throw new Error('Invalid response');
    const creatorUrl=art['creatorUrl'];
    if (creatorUrl !== null && creatorUrl !== undefined &&
      (typeof creatorUrl !== 'string' || !/^https?:\/\//i.test(creatorUrl))) throw new Error('Invalid response');
    const transparentPngSha256=string(art['transparentPngSha256']);
    if (!/^[a-f0-9]{64}$/.test(transparentPngSha256)) throw new Error('Invalid response');
    uploaded={
      origin:origin as NonNullable<ShopStampDesign['uploaded']>['origin'],
      creatorName:string(art['creatorName']),
      ...(typeof creatorUrl === 'string' ? {creatorUrl} : {}),
      transparentPngSha256,
    };
  } else throw new Error('Invalid response');
  const slug = c['shopSlug'] === null ? '' : c['shopSlug'] === undefined ? currentShopSlug : string(c['shopSlug']);
  if (slug && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new Error('Invalid response');
  return {
    id: id(c['id']), shopId: id(c['shopId']), shopSlug: slug,
    shopNameSnapshot: string(c['shopName']), shopTimezone: timezone, collectedAt,
    collectedOn: new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year:'numeric',month:'2-digit',day:'2-digit' }).format(new Date(collectedAt)),
    countryCode: countryCode as StampCollection['countryCode'], countryLabel, localityName, localitySlug, simulated: false,
    stamp: { id: stampId, tier: 'shop', motif, ink: art['ink'] as ShopStampDesign['ink'],
      localityLabel: localityName, countryLabel, designVersion: Number(art['designVersion']), paletteVersion: 1,
      ...(commissioned ? { commissioned } : {}), ...(uploaded ? { uploaded } : {}) },
  };
}

const unavailable = { ok: false, error: { code: 'service_unavailable' } } as const;
export async function stampRequest(action: 'nonce' | 'verify' | 'collect', body: object, signal: AbortSignal): Promise<StampResponseV1> {
  try {
    const response = await fetch(`/api/v1/stamps/${action}`, { method:'POST', credentials:'same-origin',
      cache:'no-store', headers:{ 'Content-Type':'application/json' }, body:JSON.stringify(body), signal });
    const value = record(await response.json());
    if (value['ok'] === false) {
      const code = record(value['error'])['code'];
      if (typeof code === 'string' && Object.hasOwn(STAMP_FAILURE_STATUS, code)) {
        return { ok:false, error:{ code:code as StampFailureCode } };
      }
    }
    if (!response.ok || value['ok'] !== true) return unavailable;
    if (value['status'] === 'nonce_issued' && action === 'nonce') {
      const nonce = string(value['nonce']);
      if (!/^[a-f0-9]{64}$/.test(nonce)) return unavailable;
      return { ok:true,status:'nonce_issued', requestId:id(value['requestId']),nonce };
    }
    if (value['status'] === 'confirmation_required' && action === 'verify') return {ok:true,status:'confirmation_required'};
    if (value['status'] === 'success' || value['status'] === 'duplicate') {
      if (value['status'] === 'success' && action !== 'collect') return unavailable;
      decodeCollection(value['collection']);
      return value as unknown as StampResponseV1;
    }
    return unavailable;
  } catch { return unavailable; }
}

export async function fetchCollections(signal: AbortSignal, expectedOwner: string): Promise<readonly StampCollection[]> {
  const result = new Map<string, StampCollection>();
  let cursor: string | null = null;
  do {
    const response = await fetch(`/api/v1/collections${cursor ? `?after=${cursor}` : ''}`,
      { credentials:'same-origin', cache:'no-store', signal });
    if (!response.ok) throw new Error('Collection read unavailable');
    const page = record(await response.json());
    if (page['ownerId'] !== expectedOwner) throw new Error('Session changed');
    if (!Array.isArray(page['collections']) || page['collections'].length > 100) throw new Error('Invalid response');
    for (const raw of page['collections']) {
      const collection = decodeCollection(raw);
      result.set(collection.id, collection);
    }
    const next = page['nextCursor'] === null ? null : id(page['nextCursor']);
    if (next && (next <= (cursor ?? '') || page['collections'].length !== 100)) throw new Error('Invalid cursor');
    cursor = next;
  } while (cursor && !signal.aborted);
  return [...result.values()];
}
