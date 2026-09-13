import { authorizeAdmin, AdminForbiddenError, adminFailure, type AdminGateway } from '@/src/server/admin/http';
import { ADMIN_HEADERS } from '@/src/server/admin/shop-http';
import { UUID, object } from '@/src/features/admin/shop-contract';
import { InvalidMedia, MAX_MEDIA_BYTES, readBounded, validatePng } from './png';

export interface Upload {
  id: string; storageKey: string; sha256: string; byteSize: number;
  purpose: 'artwork_png' | 'shop_photo'; status: 'pending' | 'validated';
  expiresAt: string; width: number | null; height: number | null;
}
export function decodeUpload(value: unknown, id: string): Upload {
  const row=object(value);
  if (row.id!==id || typeof row.storageKey!=='string' ||
      typeof row.sha256!=='string' || !/^[a-f0-9]{64}$/.test(row.sha256) ||
      typeof row.byteSize!=='number' || !Number.isInteger(row.byteSize) || row.byteSize<1 || row.byteSize>MAX_MEDIA_BYTES ||
      !['artwork_png','shop_photo'].includes(String(row.purpose)) || !['pending','validated'].includes(String(row.status)) ||
      typeof row.expiresAt!=='string' || !Number.isFinite(Date.parse(row.expiresAt))) throw Error('Invalid upload response');
  for (const key of ['width','height']) {
    const n=row[key];
    if (row.status==='pending' ? n!==null : typeof n!=='number' || !Number.isInteger(n) || n<1 || n>2048) throw Error('Invalid dimensions');
  }
  return { id, storageKey:row.storageKey, sha256:row.sha256, byteSize:row.byteSize,
    purpose:row.purpose as Upload['purpose'], status:row.status as Upload['status'],
    expiresAt:row.expiresAt, width:row.width as number|null, height:row.height as number|null };
}
export interface PrivateMediaStore {
  putOnce(key: string, bytes: Uint8Array): Promise<void>;
  get(key: string): Promise<{ size: number; contentType: string | undefined; body: ReadableStream<Uint8Array> } | null>;
}
export interface MediaGateway extends AdminGateway {
  operation(action: 'initiate' | 'read' | 'finalize', id: string, payload?: Record<string, unknown>): Promise<Upload>;
  store: PrivateMediaStore;
}
export class MediaOperationError extends Error {
  constructor(readonly code: string) { super('Media operation failed'); }
}
const json = (value: unknown, status = 200) => Response.json(value, { status, headers: ADMIN_HEADERS });
const fail = (code: string, status: number) => json({ ok: false, error: { code } }, status);
// Never return object keys, source references or private agreements to the harness.
const projection = (u: Upload) => ({ id: u.id, status: u.status, expiresAt: u.expiresAt, width: u.width, height: u.height });

export async function handleMedia(request: Request, id: string | null, gateway: MediaGateway) {
  try {
    const role=await authorizeAdmin(gateway,'editor');
    if (role instanceof Response) return role;
    if (new URL(request.url).search || (id!==null && !UUID.test(id))) return adminFailure('invalid_request');
    if (request.method!=='GET' && request.headers.get('origin')!==new URL(request.url).origin) return adminFailure('forbidden');
    if (id===null && request.method==='POST') {
      if (request.headers.get('content-type')?.split(';')[0]!=='application/json') return adminFailure('invalid_request');
      let data: Record<string,unknown>;
      try {
        data=object(JSON.parse(new TextDecoder().decode(await readBounded(request.body,8192))));
        if (Object.keys(data).some(k=>!['shopId','artworkVersionId','purpose','sha256','byteSize','contentType','sourceRef','rightsBasis','creditText','altText'].includes(k)) ||
            typeof data.shopId!=='string' || !UUID.test(data.shopId) ||
            (data.artworkVersionId!==undefined && (typeof data.artworkVersionId!=='string' || !UUID.test(data.artworkVersionId))) ||
            !['artwork_png','shop_photo'].includes(String(data.purpose)) ||
            (data.purpose==='artwork_png') !== (data.artworkVersionId!==undefined) ||
            data.contentType!=='image/png' || typeof data.sha256!=='string' || !/^[a-f0-9]{64}$/.test(data.sha256) ||
            typeof data.byteSize!=='number' || !Number.isInteger(data.byteSize) || data.byteSize<1 || data.byteSize>MAX_MEDIA_BYTES) throw Error();
        for (const [key, max] of [['sourceRef',2000],['altText',1000], ...(data.purpose==='shop_photo' ? [['rightsBasis',2000],['creditText',300]] : [])] as [string,number][]) {
          if (typeof data[key]!=='string' || !data[key].trim() || data[key].length>max) throw Error();
        }
        if (data.purpose==='artwork_png' && ('rightsBasis' in data || 'creditText' in data)) throw Error();
      } catch { return adminFailure('invalid_request'); }
      const upload=await gateway.operation('initiate',crypto.randomUUID(),data);
      return json(projection(upload),201);
    }
    if (id===null || !['GET','PUT','POST'].includes(request.method)) return adminFailure('invalid_request');
    const upload=await gateway.operation('read',id);
    if (request.method==='GET') return json(projection(upload));
    if (request.method==='POST') {
      // Finalization has no client-supplied checksum, key, dimensions or approval.
      if ((await readBounded(request.body ?? new ReadableStream({ start(c) { c.close(); } }),1)).length) return adminFailure('invalid_request');
    }
    if (upload.status==='validated') {
      return request.method==='POST' ? json(projection(upload)) : fail('upload_finalized',409);
    }
    if (Date.parse(upload.expiresAt)<=Date.now()) return fail('upload_expired',410);
    let bytes: Uint8Array;
    if (request.method==='PUT') {
      if (request.headers.get('content-type')!=='image/png') return fail('invalid_upload',422);
      bytes=await readBounded(request.body,upload.byteSize);
    } else {
      const stored=await gateway.store.get(upload.storageKey);
      if (!stored) return fail('upload_incomplete',409);
      if (stored.size!==upload.byteSize || stored.contentType!=='image/png') return fail('invalid_upload',422);
      bytes=await readBounded(stored.body,upload.byteSize);
    }
    const checked=validatePng(bytes,upload.purpose==='artwork_png');
    if (checked.sha256!==upload.sha256 || checked.byteSize!==upload.byteSize) return fail('invalid_upload',422);
    // Recheck current authority after body transfer/validation, before storage mutation.
    await gateway.operation('read',id);
    if (request.method==='PUT') {
      await gateway.store.putOnce(upload.storageKey,bytes);
      return json({ id, status: 'uploaded', next: 'finalize' });
    }
    return json(projection(await gateway.operation('finalize',id,checked)));
  } catch (error) {
    if (error instanceof AdminForbiddenError) return adminFailure('forbidden');
    if (error instanceof InvalidMedia) return fail('invalid_upload',422);
    if (error instanceof MediaOperationError) {
      if (error.code==='P0002') return fail('upload_not_found',404);
      if (error.code==='54000') return fail('upload_limit',429);
      if (['22023','23514','23502','23503','22P02','22003'].includes(error.code)) return fail('invalid_upload',422);
      if (error.code==='23505') return fail('upload_conflict',409);
    }
    return adminFailure('service_unavailable');
  }
}
