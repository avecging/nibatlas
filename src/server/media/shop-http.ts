import { authorizeAdmin, AdminForbiddenError, adminFailure, type AdminGateway } from '@/src/server/admin/http';
import { ADMIN_HEADERS } from '@/src/server/admin/shop-http';
import { object, UUID } from '@/src/features/admin/shop-contract';
import { decodeShopMedia } from '@/src/features/admin/media-contract';
import { MediaOperationError, type PrivateMediaStore } from './http';
import { MAX_MEDIA_BYTES, readBounded } from './png';
export type ShopMediaAction = 'list' | 'attach' | 'publish' | 'hide' | 'remove' | 'arrange' | 'preview' | 'public_list' | 'public_file';
export interface MediaArrangement { order: string[]; captions: Record<string,string|null>; revisions: Record<string,string>; }
export interface ShopMediaGateway extends AdminGateway {
  operation(action: ShopMediaAction, shopId: string, id?: string, revision?: string, arrangement?: MediaArrangement): Promise<unknown>;
  store: PrivateMediaStore;
}
const failure = (code: string, status: number) => Response.json({error:{code}}, {status,headers:ADMIN_HEADERS});
export async function handleShopMedia(request: Request, shopId: string, id: string | null, isPublic: boolean, gateway: ShopMediaGateway) {
  try {
    if (!isPublic) {
      const role = await authorizeAdmin(gateway, 'editor');
      if (role instanceof Response) return role;
    }
    if (!UUID.test(shopId) || (id !== null && !UUID.test(id)) || new URL(request.url).search ||
      !['GET','POST'].includes(request.method) || (isPublic && request.method !== 'GET') || (id && request.method !== 'GET')) return adminFailure('invalid_request');
    let action: ShopMediaAction = isPublic ? (id ? 'public_file' : 'public_list') : (id ? 'preview' : 'list');
    let target = id ?? undefined, revision: string | undefined, arrangement: MediaArrangement | undefined;
    if (request.method === 'POST') {
      if (request.headers.get('origin') !== new URL(request.url).origin) return adminFailure('forbidden');
      if (request.headers.get('content-type')?.split(';')[0] !== 'application/json') return adminFailure('invalid_request');
      try {
        const body = object(JSON.parse(new TextDecoder().decode(await readBounded(request.body,98304))));
        if (body.action === 'arrange') {
          const order = body.order, captions = object(body.captions), revisions = object(body.revisions);
          if (Object.keys(body).some(k => !['action','order','captions','revisions'].includes(k)) ||
            !Array.isArray(order) || order.length > 50 || order.some(v => typeof v !== 'string' || !UUID.test(v)) ||
            new Set(order).size !== order.length || Object.keys(revisions).length !== order.length ||
            order.some(v => typeof revisions[v] !== 'string' || !/^[a-f0-9]{32}$/.test(revisions[v] as string)) ||
            Object.entries(captions).some(([k,v]) => !order.includes(k) || !(v === null || typeof v === 'string' && v.length <= 300))) throw Error();
          action = 'arrange'; arrangement = {order, captions:captions as MediaArrangement['captions'], revisions:revisions as MediaArrangement['revisions']};
        } else {
          if (!['attach','publish','hide','remove'].includes(String(body.action)) || typeof body.id !== 'string' || !UUID.test(body.id) ||
            Object.keys(body).some(k => !['action','id','revision'].includes(k)) ||
            (body.action === 'attach' ? body.revision !== undefined : typeof body.revision !== 'string' || !/^[a-f0-9]{32}$/.test(body.revision))) throw Error();
          action = body.action as ShopMediaAction; target = body.id; revision = body.revision as string | undefined;
        }
      } catch { return adminFailure('invalid_request'); }
      if (action !== 'attach') {
        const role = await authorizeAdmin(gateway,'admin');
        if (role instanceof Response) return role;
      }
    }
    const value = arrangement ? await gateway.operation(action,shopId,target,revision,arrangement) : await gateway.operation(action,shopId,target,revision);
    if (id) {
      const key = object(value).storageKey;
      if (typeof key !== 'string') throw Error();
      const stored = await gateway.store.get(key);
      if (!stored) return failure('media_not_found',404);
      if (stored.contentType !== 'image/png' || stored.size < 1 || stored.size > MAX_MEDIA_BYTES) throw Error();
      // No persistent public cache: hide/archive and live role are rechecked on each fetch.
      await gateway.operation(action,shopId,target);
      return new Response(stored.body, {headers:{...ADMIN_HEADERS,'Content-Type':'image/png',
        'X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'",'Content-Length':String(stored.size)}});
    }
    return Response.json({entries:decodeShopMedia(value,!isPublic), ...(!isPublic ? {capabilities:['remove','arrange']} : {})}, {headers:ADMIN_HEADERS});
  } catch (error) {
    if (error instanceof AdminForbiddenError) return adminFailure('forbidden');
    if (error instanceof MediaOperationError) {
      if (error.code === 'P0002') return failure('media_not_found',404);
      if (error.code === '40001') return failure('revision_conflict',409);
      if (error.code === '54000') return failure('media_limit',429);
      if (['22023','23514','23503'].includes(error.code)) return failure('invalid_media_target',422);
    }
    return adminFailure('service_unavailable');
  }
}
