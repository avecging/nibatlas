import { authorizeAdmin, adminFailure, AdminForbiddenError } from './http';
import { ADMIN_HEADERS, type ShopAdminGateway } from './shop-http';
import { object, UUID } from '@/src/features/admin/shop-contract';
import { VERSION, eligible, type ImportOperation } from '@/src/features/admin/import/contract';
import { importBody, parseRows, prepareImport } from './import-http';
const json = (v: unknown, status = 200) => Response.json(v, { status, headers: ADMIN_HEADERS });
export class ImportConflictError extends Error {}

export async function handleImportBatch(request: Request, gateway: ShopAdminGateway) {
  try {
    const access = await authorizeAdmin(gateway, 'admin'); if (access instanceof Response) return access;
    const url = new URL(request.url);
    if (request.method === 'GET') {
      if ([...url.searchParams.keys()].some(k => k !== 'batch') || url.searchParams.getAll('batch').length > 1) return adminFailure('invalid_request');
      const batchId = url.searchParams.get('batch');
      if (batchId !== null && !UUID.test(batchId)) return adminFailure('invalid_request');
      return json(await gateway.call('admin_import_batches', { p_batch: batchId }));
    }
    if (request.method !== 'POST' || url.search) return adminFailure('invalid_request');
    if (request.headers.get('origin') !== url.origin) return adminFailure('forbidden');
    let input: Record<string, unknown>;
    try {
      input = await importBody(request);
      if (input.version !== VERSION || typeof input.batchId !== 'string' || !UUID.test(input.batchId) ||
        !['review', 'execute'].includes(String(input.action)) || Object.keys(input).some(k => !['version', 'batchId', 'action', 'operationId', 'previousOperation', 'row', 'reviewKey'].includes(k)) ||
        typeof input.operationId !== 'string' || !UUID.test(input.operationId)) throw Error();
      if (input.action === 'review') {
        parseRows([input.row]);
        if (typeof input.reviewKey !== 'string' || !/^[a-f0-9]{64}$/.test(input.reviewKey) ||
          input.previousOperation !== null && input.previousOperation !== undefined && (typeof input.previousOperation !== 'string' || !UUID.test(input.previousOperation))) throw Error();
      } else if (['row', 'reviewKey', 'previousOperation'].some(k => k in input)) throw Error();
    } catch { return adminFailure('invalid_request'); }
    const batchId = String(input.batchId), operationId = String(input.operationId);
    if (input.action === 'review') {
      const row = parseRows([input.row])[0]!;
      const [prepared] = await prepareImport([row], batchId, gateway);
      if (!prepared || !eligible(prepared.preview) || prepared.preview.reviewKey !== input.reviewKey) {
        return json({ error: { code: 'conflict' }, message: 'This row changed or is unresolved. Run a fresh preview and review it again.' }, 409);
      }
      const result = await gateway.call('admin_import_operation', { p_action: 'review', p_batch: batchId, p_operation: operationId, p_payload: {
        row, preview: prepared.preview, document: prepared.document, targetId: prepared.preview.targetId ?? prepared.proposedId,
        revision: prepared.preview.revision, reviewKey: input.reviewKey, previousOperation: input.previousOperation ?? null,
      } });
      return json(result);
    }
    // Recover authoritative input from the protected ledger, not the browser.
    const op = object(await gateway.call('admin_import_operation_read', { p_batch: batchId, p_operation: operationId })) as unknown as ImportOperation;
    if (op.status === 'imported' || op.status === 'skipped' || op.status === 'conflicted') {
      // SQL checks current authority again even for a completed replay.
      return json(await gateway.call('admin_import_operation', { p_action: 'execute', p_batch: batchId, p_operation: operationId, p_payload: {} }));
    }
    const [prepared] = await prepareImport(parseRows([op.patch]), batchId, gateway);
    const valid = prepared && eligible(prepared.preview) && prepared.preview.reviewKey === op.review_key;
    return json(await gateway.call('admin_import_operation', { p_action: 'execute', p_batch: batchId, p_operation: operationId,
      p_payload: valid ? { document: prepared.document, reviewKey: prepared.preview.reviewKey } : {} }));
  } catch (e) {
    if (e instanceof ImportConflictError) return json({ error: { code: 'conflict' }, message: 'The operation or record changed. Reopen the batch and review again.' }, 409);
    return adminFailure(e instanceof AdminForbiddenError ? 'forbidden' : 'service_unavailable');
  }
}
