import { authorizeAdmin, AdminForbiddenError, adminFailure, type AdminGateway } from './http';
import { ADMIN_HEADERS } from './shop-http';
import { UUID } from '@/src/features/admin/shop-contract';
import { decodePublicationRequest, decodePublication, type PublicationRequest } from '@/src/features/admin/publication-contract';
import { readBounded } from '@/src/server/media/png';
import { MediaOperationError } from '@/src/server/media/http';
export interface PublicationGateway extends AdminGateway { operation(shop: string, save: PublicationRequest | null): Promise<unknown>; }
export async function handlePublication(request: Request, shop: string, gateway: PublicationGateway) {
  const json = (value: unknown, status = 200) => Response.json(value,{status,headers:ADMIN_HEADERS});
  try {
    const access = await authorizeAdmin(gateway,'admin');
    if (access instanceof Response) return access;
    if (!UUID.test(shop) || new URL(request.url).search || !['GET','POST'].includes(request.method)) return adminFailure('invalid_request');
    let save: PublicationRequest | null = null;
    if (request.method === 'POST') {
      if (request.headers.get('origin') !== new URL(request.url).origin) return adminFailure('forbidden');
      try {
        if (request.headers.get('content-type')?.split(';')[0] !== 'application/json') throw Error();
        save = decodePublicationRequest(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(await readBounded(request.body,1024))));
      } catch { return adminFailure('invalid_request'); }
    }
    return json(decodePublication(await gateway.operation(shop,save)));
  } catch (error) {
    if (error instanceof AdminForbiddenError) return adminFailure('forbidden');
    if (error instanceof MediaOperationError) {
      if (error.code === '40001' || error.code === '23505') return json({error:{code:'review_conflict'}},409);
      if (error.code === 'P0002') return json({error:{code:'shop_not_found'}},404);
      if (['22023','23514','23503'].includes(error.code)) return json({error:{code:'invalid_publication'}},422);
    }
    return adminFailure('service_unavailable');
  }
}
