import { authorizeAdmin, adminFailure, AdminForbiddenError } from './http';
import { ADMIN_HEADERS, type ShopAdminGateway } from './shop-http';
import { UUID } from '@/src/features/admin/shop-contract';
import { VERSION } from '@/src/features/admin/import/contract';
import { importBody } from './import-http';
import { ImportConflictError } from './import-batch-http';
const json = (v: unknown, status = 200) => Response.json(v, { status, headers: ADMIN_HEADERS });
export async function handleImportPublication(request: Request, gateway: ShopAdminGateway) {
  try {
    const access = await authorizeAdmin(gateway, 'admin'); if (access instanceof Response) return access;
    const url = new URL(request.url);
    if (request.method === 'GET') {
      if ([...url.searchParams.keys()].some(k => !['batch', 'offset', 'import'].includes(k) || url.searchParams.getAll(k).length !== 1)) return adminFailure('invalid_request');
      const batch = url.searchParams.get('batch'), imported = url.searchParams.get('import'), offset = url.searchParams.get('offset') ?? '0';
      if (!batch || !UUID.test(batch) || imported !== null && !UUID.test(imported) || !/^\d{1,3}$/.test(offset) || Number(offset) > 499 || imported && offset !== '0') return adminFailure('invalid_request');
      return json(await gateway.call('admin_import_publication_read', { p_batch: batch, p_offset: Number(offset), p_import: imported }));
    }
    if (request.method !== 'POST' || url.search) return adminFailure('invalid_request');
    if (request.headers.get('origin') !== url.origin) return adminFailure('forbidden');
    let input: Record<string, unknown>;
    try {
      input = await importBody(request);
      if (input.version !== VERSION || !['review', 'confirm_position', 'publish'].includes(String(input.action)) ||
        ['batchId', 'importId', 'operationId'].some(k => typeof input[k] !== 'string' || !UUID.test(input[k] as string)) ||
        Object.keys(input).some(k => !['version', 'action', 'batchId', 'importId', 'operationId', 'reviewKey', 'previousOperation'].includes(k))) throw Error();
      if (input.action === 'review') {
        if (typeof input.reviewKey !== 'string' || !/^[a-f0-9]{64}$/.test(input.reviewKey) ||
          input.previousOperation !== null && (typeof input.previousOperation !== 'string' || !UUID.test(input.previousOperation))) throw Error();
      } else if ('reviewKey' in input || 'previousOperation' in input) throw Error();
    } catch { return adminFailure('invalid_request'); }
    return json(await gateway.call('admin_import_publication', {
      p_action: input.action, p_batch: input.batchId, p_import: input.importId, p_operation: input.operationId,
      p_payload: input.action === 'review' ? { reviewKey: input.reviewKey, previousOperation: input.previousOperation } : {},
    }));
  } catch (e) {
    if (e instanceof ImportConflictError) return json({ error: { code: 'conflict' } }, 409);
    return adminFailure(e instanceof AdminForbiddenError ? 'forbidden' : 'service_unavailable');
  }
}
