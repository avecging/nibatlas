import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { isShopId } from '@/src/api/v1/saved-shops';
import { STAMP_FAILURE_STATUS, type StampFailureCode, type StampResponseV1, type CollectionV1 } from '@/src/api/v1/stamp-verification';
import { encryptPosition } from '@/src/server/stamps/envelope';

export type StampAction = 'nonce' | 'verify' | 'collect';
export interface StampGateway {
  getIdentity(): Promise<string | null>;
  rateLimit(userId: string): Promise<boolean>;
  action(input: { action: string; userId: string; shopId: string; requestId: string; nonceHash: string;
    payload?: Record<string, unknown> }): Promise<unknown>;
}
const HEADERS = { 'Cache-Control': 'private, no-store', Pragma: 'no-cache', Vary: 'Cookie' };
function json(body: StampResponseV1, status = 200) { return Response.json(body, { status, headers: HEADERS }); }
export function stampFailure(code: StampFailureCode) {
  return json({ ok: false, error: { code } }, STAMP_FAILURE_STATUS[code]);
}
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid object');
  return value as Record<string, unknown>;
}
function uuid(value: unknown): value is string { return typeof value === 'string' && isShopId(value); }
function exactKeys(value: Record<string, unknown>, keys: readonly string[]) {
  if (Object.keys(value).some(key => !keys.includes(key))) throw new Error('Invalid fields');
}
async function body(request: Request) {
  if (request.headers.get('content-type')?.split(';')[0]?.trim() !== 'application/json') throw new Error('Invalid content type');
  const reader = request.body?.getReader();
  if (!reader) throw new Error('Missing body');
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const part = await reader.read();
    if (part.done) break;
    size += part.value.byteLength;
    if (size > 2048) { await reader.cancel(); throw new Error('Oversized body'); }
    chunks.push(part.value);
  }
  return object(JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown);
}
function upstreamFailure(value: Record<string, unknown>): Response {
  const code = value['code'];
  return stampFailure(typeof code === 'string' && Object.hasOwn(STAMP_FAILURE_STATUS, code)
    ? code as StampFailureCode : 'service_unavailable');
}
function collectionResponse(value: Record<string, unknown>, expectedShop: string): Response {
  const c = object(value['collection']);
  const place = object(c['place']);
  const stamp = object(c['stamp']);
  if (!uuid(c['id']) || !uuid(c['stampId']) || c['shopId'] !== expectedShop
    || typeof c['collectedAt'] !== 'string' || !Number.isFinite(Date.parse(c['collectedAt']))
    || typeof c['shopName'] !== 'string' || typeof c['shopTimezone'] !== 'string'
    || typeof place['countryCode'] !== 'string' || typeof place['localitySlug'] !== 'string'
    || stamp['id'] !== c['stampId']) throw new Error('Invalid collection');
  // Explicit outer projection: never forward diagnostic fields from the provider.
  const collection: CollectionV1 = { id: c['id'], shopId: expectedShop, stampId: c['stampId'],
    collectedAt: c['collectedAt'], shopTimezone: c['shopTimezone'], shopName: c['shopName'], place, stamp };
  return json({ ok: true, status: value['code'] === 'success' ? 'success' : 'duplicate', collection,
    invalidate: ['collections', 'visited-shops', 'passport'] });
}

export async function handleStampRequest(request: Request, action: StampAction, gateway: StampGateway): Promise<Response> {
  // Catch every failure without logging request bodies, coordinates or provider errors.
  try {
    if (request.method !== 'POST' || new URL(request.url).search) return stampFailure('invalid_request');
    if (request.headers.get('origin') !== new URL(request.url).origin) return stampFailure('untrusted_origin');
    const userId = await gateway.getIdentity();
    if (!userId || !isShopId(userId)) return stampFailure('authentication_required');
    if (!await gateway.rateLimit(userId)) return stampFailure('throttled');
    let input: Record<string, unknown>;
    let shopId: string;
    let requestId: string;
    let nonce: string;
    let position: Record<string, number> | undefined;
    try {
      input = await body(request);
      if (!uuid(input['shopId'])) throw new Error('Invalid shop');
      shopId = input['shopId'].toLowerCase();
      if (action === 'nonce') {
        exactKeys(input, ['shopId']);
        requestId = randomUUID();
        nonce = randomBytes(32).toString('hex');
      } else {
        if (!uuid(input['requestId']) || typeof input['nonce'] !== 'string' || !/^[a-f0-9]{64}$/.test(input['nonce'])) throw new Error('Invalid binding');
        requestId = input['requestId'].toLowerCase();
        nonce = input['nonce'];
        if (action === 'verify') {
          exactKeys(input, ['shopId', 'requestId', 'nonce', 'position', 'permission']);
          if (input['permission'] === 'denied') {
            if ('position' in input) throw new Error('Conflicting position');
          } else {
            if ('permission' in input) throw new Error('Invalid permission');
            const p = object(input['position']);
            exactKeys(p, ['latitude', 'longitude', 'accuracy']);
            const lat=p['latitude'], lon=p['longitude'], acc=p['accuracy'];
            if (typeof lat !== 'number' || !Number.isFinite(lat) || Math.abs(lat)>90
              || typeof lon !== 'number' || !Number.isFinite(lon) || Math.abs(lon)>180
              || typeof acc !== 'number' || !Number.isFinite(acc) || acc<0 || acc>1000000) throw new Error('Invalid position');
            position = { latitude:lat, longitude:lon, accuracy:acc };
          }
        } else {
          exactKeys(input, ['shopId', 'requestId', 'nonce', 'confirmedAtShop']);
          if (input['confirmedAtShop'] !== true) throw new Error('Confirmation required');
        }
      }
    } catch { return stampFailure('invalid_request'); }
    const binding = { userId, shopId, requestId,
      nonceHash: createHash('sha256').update(nonce).digest('hex') };
    let payload: Record<string, unknown> = {};
    if (action !== 'nonce') {
      const context = object(await gateway.action({ ...binding, action: `context_${action}` }));
      if (context['code'] === 'duplicate') return collectionResponse(context, shopId);
      if (context['code'] !== 'context') return upstreamFailure(context);
      if (action === 'verify') {
        if (position) {
          if (typeof context['key'] !== 'string') return stampFailure('service_unavailable');
          payload = encryptPosition(position, context['key']);
        } else payload = { permission: 'denied' };
      } else {
        if (typeof context['countryCode'] !== 'string' || !/^[A-Z]{2}$/.test(context['countryCode'])) return stampFailure('service_unavailable');
        const countryLabel = new Intl.DisplayNames(['en'], { type: 'region' }).of(context['countryCode']);
        payload = { confirmedAtShop: true, countryLabel };
      }
    }
    const result = object(await gateway.action({ ...binding, action, payload }));
    if (result['code'] === 'success' || result['code'] === 'duplicate') return collectionResponse(result, shopId);
    if (action === 'nonce' && result['code'] === 'nonce_issued') return json({ ok: true, status: 'nonce_issued', nonce, requestId });
    if (action === 'verify' && result['code'] === 'confirmation_required') return json({ ok: true, status: 'confirmation_required' });
    return upstreamFailure(result);
  } catch { return stampFailure('service_unavailable'); }
}
