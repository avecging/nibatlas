import { isShopId } from '@/src/api/v1/saved-shops';

export type AdminRole = 'editor' | 'admin';
export interface AdminGateway {
  getIdentity(): Promise<string | null>;
  getAccess(): Promise<unknown>;
  listAudit(after: string | null): Promise<unknown>;
}
const HEADERS = { 'Cache-Control': 'private, no-store', Pragma: 'no-cache', Vary: 'Cookie' };
export function adminFailure(code: 'authentication_required' | 'forbidden' | 'invalid_request' | 'service_unavailable') {
  const status = { authentication_required: 401, forbidden: 403, invalid_request: 400, service_unavailable: 503 }[code];
  return Response.json({ ok: false, error: { code } }, { status, headers: HEADERS });
}
export class AdminForbiddenError extends Error {}

/** Per-request guard, never memoized across requests or derived from metadata. */
export async function authorizeAdmin(gateway: AdminGateway, minimum: AdminRole): Promise<AdminRole | Response> {
  const identity = await gateway.getIdentity();
  if (!identity || !isShopId(identity)) return adminFailure('authentication_required');
  const access = await gateway.getAccess();
  if (!access || typeof access !== 'object' || Array.isArray(access)) throw new Error('Invalid access');
  const role = (access as Record<string, unknown>)['role'];
  if (role !== 'admin' && role !== 'editor') return adminFailure('forbidden');
  if (minimum === 'admin' && role !== 'admin') return adminFailure('forbidden');
  return role;
}

function auditRows(value: unknown) {
  if (!Array.isArray(value) || value.length > 101) throw new Error('Invalid audit page');
  return value.map((item: unknown) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error('Invalid audit entry');
    const row = item as Record<string, unknown>;
    const before = row['before'] as Record<string, unknown> | null;
    const after = row['after'] as Record<string, unknown> | null;
    const role = (value: unknown) => value === 'user' || value === 'editor' || value === 'admin';
    if (typeof row['id'] !== 'string' || !isShopId(row['id'])
      || typeof row['entityId'] !== 'string' || !isShopId(row['entityId'])
      || typeof row['requestId'] !== 'string' || !isShopId(row['requestId'])
      || (row['actorUserId'] !== null && (typeof row['actorUserId'] !== 'string' || !isShopId(row['actorUserId'])))
      || !['database_operator', 'account'].includes(String(row['actorKind']))
      || row['action'] !== 'profile_role_changed' || row['entityType'] !== 'profile'
      || !role(before?.['role']) || !role(after?.['role'])
      || typeof row['createdAt'] !== 'string' || !Number.isFinite(Date.parse(row['createdAt']))) {
      throw new Error('Invalid audit entry');
    }
    // Project nested summaries too: future provider fields never become public.
    return { id: row['id'], actorUserId: row['actorUserId'], actorKind: row['actorKind'],
      action: row['action'], entityType: row['entityType'], entityId: row['entityId'],
      before: { role: before?.['role'] }, after: { role: after?.['role'] },
      requestId: row['requestId'], createdAt: row['createdAt'] };
  });
}

export async function handleAdminRead(request: Request, action: 'access' | 'audit', gateway: AdminGateway): Promise<Response> {
  try {
    const params = new URL(request.url).searchParams;
    const after = params.get('after');
    if (request.method !== 'GET' || (action === 'access' && [...params].length > 0)
      || [...params.keys()].some(key => key !== 'after') || params.getAll('after').length > 1
      || (after !== null && !isShopId(after))) return adminFailure('invalid_request');
    const role = await authorizeAdmin(gateway, action === 'audit' ? 'admin' : 'editor');
    if (role instanceof Response) return role;
    if (action === 'access') return Response.json({ role }, { headers: HEADERS });
    const rows = auditRows(await gateway.listAudit(after));
    const entries = rows.slice(0, 100);
    return Response.json({ entries, nextCursor: rows.length > 100 ? entries.at(-1)?.id : null }, { headers: HEADERS });
  } catch (error) {
    return adminFailure(error instanceof AdminForbiddenError ? 'forbidden' : 'service_unavailable');
  }
}
