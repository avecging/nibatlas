import { describe, expect, it, vi } from 'vitest';
import { handleImportPublication } from './import-publication-http';
import { ImportConflictError } from './import-batch-http';
import { AdminForbiddenError } from './http';
import { VERSION } from '@/src/features/admin/import/contract';
const id = '73000000-0000-4000-8000-000000000001';
const body = { version: VERSION, batchId: id, importId: id, operationId: id, action: 'review', reviewKey: 'a'.repeat(64), previousOperation: null };
const request = (payload: unknown) => new Request('https://example.test/api/v1/admin/import/publication', { method: 'POST', headers: { origin: 'https://example.test', 'content-type': 'application/json' }, body: JSON.stringify(payload) });
const gateway = (role = 'admin') => ({ getIdentity: vi.fn(async (): Promise<string | null> => id), getAccess: vi.fn(async () => ({ role })), listAudit: vi.fn(), call: vi.fn(async (): Promise<unknown> => ({ rows: [], nextOffset: null })) });
describe('saved-batch publication HTTP', () => {
 it('checks current admin identity for reads and writes before any RPC', async () => {
  for (const role of ['user', 'editor']) {
   const g = gateway(role); expect((await handleImportPublication(request(body), g)).status).toBe(403);
   expect((await handleImportPublication(new Request(`https://example.test/api?batch=${id}`), g)).status).toBe(403); expect(g.call).not.toHaveBeenCalled();
  }
  const g = gateway(); g.getIdentity.mockResolvedValue(null); expect((await handleImportPublication(request(body), g)).status).toBe(401);
 });
 it('uses one ordinary gateway call with narrow exact review binding', async () => {
  const g = gateway(); const response = await handleImportPublication(request(body), g);
  expect(response.status).toBe(200); expect(response.headers.get('cache-control')).toContain('no-store');
  expect(g.call).toHaveBeenCalledExactlyOnceWith('admin_import_publication', { p_action: 'review', p_batch: id, p_import: id, p_operation: id, p_payload: { reviewKey: 'a'.repeat(64), previousOperation: null } });
 });
 it('confirmation/publication carry only persisted identities, never a browser document or revision', async () => {
  for (const action of ['publish', 'confirm_position']) {
   const g = gateway(), payload = { version: VERSION, batchId: id, importId: id, operationId: id, action };
   expect((await handleImportPublication(request(payload), g)).status).toBe(200);
   expect(g.call).toHaveBeenLastCalledWith('admin_import_publication', { p_action: action, p_batch: id, p_import: id, p_operation: id, p_payload: {} });
   for (const extra of [{ document: {} }, { revision: 'fake' }, { reviewKey: 'a'.repeat(64) }, { previousOperation: null }, { publishAll: true }]) expect((await handleImportPublication(request({ ...payload, ...extra }), g)).status).toBe(400);
  }
 });
 it('rejects cross-origin, oversized, malformed and extra inputs', async () => {
  const g = gateway(), cross = request(body); cross.headers.set('origin', 'https://evil.test'); expect((await handleImportPublication(cross, g)).status).toBe(403);
  for (const bad of [{ ...body, action: 'publish_all' }, { ...body, batchId: 'bad' }, { ...body, reviewKey: 'bad' }, { ...body, extra: 'x'.repeat(262144) }]) expect((await handleImportPublication(request(bad), g)).status).toBe(400);
  expect(g.call).not.toHaveBeenCalled();
 });
 it('reads bounded pages or a single same-batch detail', async () => {
  const g = gateway();
  expect((await handleImportPublication(new Request(`https://example.test/api?batch=${id}&offset=175`), g)).status).toBe(200);
  expect(g.call).toHaveBeenLastCalledWith('admin_import_publication_read', { p_batch: id, p_offset: 175, p_import: null });
  for (const query of [`batch=${id}&offset=500`, `batch=${id}&offset=-1`, `batch=${id}&batch=${id}`, `batch=${id}&import=${id}&offset=25`, `batch=${id}&limit=500`]) expect((await handleImportPublication(new Request(`https://example.test/api?${query}`), g)).status).toBe(400);
 });
 it('preserves denied/conflict statuses and hides raw provider errors', async () => {
  for (const [error, status] of [[new AdminForbiddenError(), 403], [new ImportConflictError(), 409], [Error('private provider failure'), 503]] as const) {
   const g = gateway(); g.call.mockRejectedValue(error); const r = await handleImportPublication(request(body), g); expect(r.status).toBe(status); expect(await r.text()).not.toContain('private provider');
  }
 });
});
