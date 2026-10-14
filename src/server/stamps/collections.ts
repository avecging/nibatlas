import { isShopId } from '@/src/api/v1/saved-shops';
import { stampFailure } from './http';

export interface CollectionReadGateway {
  getIdentity(): Promise<string | null>;
  list(after: string | null): Promise<unknown>;
}

export async function listCollections(request: Request, gateway: CollectionReadGateway): Promise<Response> {
  try {
    const params = new URL(request.url).searchParams;
    const after = params.get('after');
    if (request.method !== 'GET' || [...params.keys()].some(key => key !== 'after')
      || params.getAll('after').length > 1 || (after !== null && !isShopId(after))) {
      return stampFailure('invalid_request');
    }
    const owner = await gateway.getIdentity();
    if (!owner || !isShopId(owner)) return stampFailure('authentication_required');
    const rows = await gateway.list(after);
    if (!Array.isArray(rows) || rows.length > 101) return stampFailure('service_unavailable');
    // Explicit projection: no user ID, diagnostics or future provider fields.
    const collections = rows.slice(0, 100).map((row: Record<string, unknown>) => {
      if (typeof row['id'] !== 'string' || !isShopId(row['id'])) throw new Error('Invalid collection');
      return { id: row['id'], shopId: row['shopId'], stampId: row['stampId'],
        collectedAt: row['collectedAt'], shopTimezone: row['shopTimezone'],
        shopName: row['shopName'], place: row['place'], stamp: row['stamp'], shopSlug: row['shopSlug'] };
    });
    return Response.json({ ownerId:owner, collections, nextCursor: rows.length > 100 ? collections.at(-1)?.id : null },
      { headers: { 'Cache-Control': 'private, no-store', Pragma: 'no-cache', Vary: 'Cookie' } });
  } catch { return stampFailure('service_unavailable'); }
}
