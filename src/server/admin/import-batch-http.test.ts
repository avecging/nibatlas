import { describe, expect, it, vi } from 'vitest';
import { handleImportBatch, ImportConflictError } from './import-batch-http';
import { AdminForbiddenError } from './http';
import { VERSION, type MappedRow } from '@/src/features/admin/import/contract';
const batch = '73000000-0000-4000-8000-000000000001', op = '73000000-0000-4000-8000-000000000002';
const key = 'a'.repeat(64);
const row: MappedRow = { rowId: 'one', line: 2, cells: { name: 'Synthetic' }, issues: [], fileDuplicates: [] };
const options = { localities: [], types: [], brands: [], specialties: [], services: [] };
const request = (body: unknown) => new Request('https://example.test/api/v1/admin/import/batches', { method: 'POST', headers: { origin: 'https://example.test', 'content-type': 'application/json' }, body: JSON.stringify(body) });
const payload = { version: VERSION, batchId: batch, operationId: op, action: 'review', row, reviewKey: key };
function gateway(role = 'admin', status = 'ready') {
 return { getIdentity: vi.fn(async () => batch), getAccess: vi.fn(async () => ({ role })), listAudit: vi.fn(), call: vi.fn(async (name: string, args?: Record<string, unknown>): Promise<unknown> => {
  if (name === 'admin_shop_options') return options;
  if (name === 'admin_import_operation_read') return { id: op, row_id: 'one', status, patch: row, review_key: key };
  if (name === 'admin_import_operation') return { id: op, rowId: 'one', status: 'imported', targetId: batch };
  if (name === 'admin_import_preview') return args?.p_mode === 'context' ? [{ rowId: 'one', record: null, candidates: [], truncated: false, conflict: false }] : [{ rowId: 'one', issues: [], publicationErrors: ['Missing location'], reviewKey: key }];
  throw Error();
 }) };
}
describe('private import HTTP', () => {
 it('requires current admin for batch reads/writes and same origin for mutation', async () => {
  for (const role of ['editor', 'user']) { const g = gateway(role); expect((await handleImportBatch(request(payload), g)).status).toBe(403); expect(g.call).not.toHaveBeenCalled(); }
  const g = gateway(); const cross = request(payload); cross.headers.set('origin', 'https://evil.test');
  expect((await handleImportBatch(cross, g)).status).toBe(403); expect(g.call).not.toHaveBeenCalled();
  g.getIdentity.mockResolvedValue(null as unknown as string); expect((await handleImportBatch(new Request('https://example.test/api/v1/admin/import/batches'), g)).status).toBe(401);
 });
 it('reprepares a complete normalized draft for review without requiring publication readiness', async () => {
  const g = gateway(); expect((await handleImportBatch(request(payload), g)).status).toBe(200);
  const call = g.call.mock.calls.find(([name]) => name === 'admin_import_operation')!;
  expect(call[1]?.p_payload).toMatchObject({ row, document: { shop: { name: 'Synthetic' }, sources: [], brands: [], experiences: [] } });
  expect(g.call.mock.calls.some(([name]) => name === 'admin_shop_write')).toBe(false);
 });
 it('cannot substitute an old or unreviewed operation or send a document during execution', async () => {
  const g = gateway(); expect((await handleImportBatch(request({ ...payload, reviewKey: 'b'.repeat(64) }), g)).status).toBe(409);
  expect(g.call.mock.calls.some(([name]) => name === 'admin_import_operation')).toBe(false);
  expect((await handleImportBatch(request({ version: VERSION, batchId: batch, operationId: op, action: 'execute', document: {} }), g)).status).toBe(400);
 });
 it('loads persisted patch at execution, reparses and validates, then delegates atomic binding check', async () => {
  const g = gateway(); expect((await handleImportBatch(request({ version: VERSION, batchId: batch, operationId: op, action: 'execute' }), g)).status).toBe(200);
  expect(g.call.mock.calls.map(([name]) => name)).toEqual(['admin_import_operation_read', 'admin_shop_options', 'admin_import_preview', 'admin_import_preview', 'admin_import_operation']);
  expect(g.call.mock.calls.at(-1)?.[1]).toMatchObject({ p_payload: { reviewKey: key, document: { shop: { name: 'Synthetic' } } } });
 });
 it('replays a completed operation without repreparing/repeating its update', async () => {
  const g = gateway('admin', 'imported'); await handleImportBatch(request({ version: VERSION, batchId: batch, operationId: op, action: 'execute' }), g);
  expect(g.call.mock.calls.map(([name]) => name)).toEqual(['admin_import_operation_read', 'admin_import_operation']);
  expect(g.call.mock.calls.at(-1)?.[1]?.p_payload).toEqual({});
 });
 it('records a conflict if authoritative validation changes after review', async () => {
  const g = gateway(), original = g.call.getMockImplementation()!;
  g.call.mockImplementation((name, args) => name === 'admin_import_preview' && args?.p_mode === 'validate' ? Promise.resolve([{ rowId: 'one', issues: [{ path: 'shop_id', message: 'Changed' }], publicationErrors: [] }]) : original(name, args));
  await handleImportBatch(request({ version: VERSION, batchId: batch, operationId: op, action: 'execute' }), g);
  expect(g.call.mock.calls.at(-1)?.[1]?.p_payload).toEqual({});
 });
 it('redacts provider errors, handles revocation and preserves conflict status', async () => {
  for (const [error, expected] of [[new AdminForbiddenError(), 403], [new ImportConflictError(), 409], [Error('secret raw source'), 503]] as const) {
   const g = gateway(); g.call.mockRejectedValue(error); const res = await handleImportBatch(request(payload), g); expect(res.status).toBe(expected); expect(await res.text()).not.toContain('secret'); expect(res.headers.get('cache-control')).toContain('no-store');
  }
 });
});
