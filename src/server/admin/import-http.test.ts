import { describe, expect, it, vi } from 'vitest';
import { handleImport } from './import-http';
import { AdminForbiddenError } from './http';
import { document } from '@/src/features/admin/shop-contract';
import { VERSION, type MappedRow } from '@/src/features/admin/import/contract';
const id = '70000000-0000-4000-8000-000000000001';
const options = { localities: [], types: [], services: [], brands: [], specialties: [] };
const row = (i = 1): MappedRow => ({ rowId: `row-${i}`, line: i + 1, cells: { name: `Synthetic ${i}` }, issues: [], fileDuplicates: [] });
function gateway(role = 'admin') {
  return { getIdentity: vi.fn(async () => id), getAccess: vi.fn(async () => ({ role })), listAudit: vi.fn(), call: vi.fn(async (name: string, args?: Record<string, unknown>): Promise<unknown> => {
    if (name === 'admin_shop_options') return options;
    if (name !== 'admin_import_preview') throw Error('No mutation or unrelated read is permitted');
    const rows = args!.p_rows as { rowId: string }[];
    if (args!.p_mode === 'context') return rows.map(r => ({ rowId: r.rowId, record: null, candidates: [], truncated: false, conflict: false }));
    if (args!.p_mode === 'validate') return rows.map(r => ({ rowId: r.rowId, issues: [], publicationErrors: ['Check and confirm the saved shop position.'] }));
    throw Error('Invalid mode');
  }) };
}
const request = (rows: unknown = [row()], overrides = {}) => new Request('https://example.test/api/v1/admin/import', { method: 'POST', headers: { origin: 'https://example.test', 'content-type': 'application/json' }, body: JSON.stringify({ version: VERSION, batchId: id, rows }), ...overrides });
describe('admin-only non-mutating import boundary', () => {
  it('requires current admin role for reads and previews before looking at data', async () => {
    for (const role of ['editor', 'user']) { const g = gateway(role); expect((await handleImport(request(), g)).status).toBe(403); expect(g.call).not.toHaveBeenCalled(); }
    const g = gateway(); g.getIdentity.mockResolvedValue(null as unknown as string);
    expect((await handleImport(request(), g)).status).toBe(401); expect(g.call).not.toHaveBeenCalled();
  });
  it('rejects cross-origin, unexpected actions, oversized, malformed and unbounded requests', async () => {
    const g = gateway();
    for (const r of [request([], {}), request(Array.from({ length: 26 }, (_, i) => row(i))), request([row(), row()]), request([{ ...row(), cells: { media_url: 'https://internal.test' } }]), request([row()], { headers: { origin: 'https://evil.test', 'content-type': 'application/json' } }), request([row()], { body: 'x'.repeat(262145) }), request([row()], { body: JSON.stringify({ version: VERSION, batchId: id, action: 'save', rows: [row()] }) })]) expect((await handleImport(r, g)).status).toBeGreaterThanOrEqual(400);
    expect(g.call).not.toHaveBeenCalled();
  });
  it('catches live-role revocation at SQL and never returns provider details', async () => {
    const g = gateway(); g.call.mockRejectedValue(new AdminForbiddenError()); expect((await handleImport(request(), g)).status).toBe(403);
    g.call.mockRejectedValue(Error('private provider secret')); const response = await handleImport(request(), g); expect(response.status).toBe(503); expect(await response.text()).not.toContain('secret');
  });
  it('uses authoritative validation and blocks backend rejection', async () => {
    const g = gateway(); const original = g.call.getMockImplementation()!;
    g.call.mockImplementation(async (name, args) => args?.p_mode === 'validate' ? [{ rowId: 'row-1', issues: [{ path: 'shop_id', message: 'Revision changed. Preview again.' }], publicationErrors: [] }] : original(name, args));
    const response = await handleImport(request(), g); expect(response.status).toBe(200);
    expect((await response.json()).rows[0]).toMatchObject({ action: 'blocked', issues: [{ path: 'shop_id', message: 'Revision changed. Preview again.' }] });
  });
  it('bounds full merged validation documents even when imported updates are tiny', async () => {
    const g = gateway(), original = g.call.getMockImplementation()!;
    const doc = document({ shop: { name: 'Existing', slug: 'existing', source_quality: 'community_unverified', operational_status: 'unknown', position_precision: 'locality' }, sources: [], aliases: [], links: [], types: [], brands: [], specialties: [], services: [], experiences: Array.from({ length: 24 }, (_, i) => ({ id: `80000000-0000-4000-8000-${String(i).padStart(12, '0')}`, category: 'other', title: 'Legacy experience', description: 'x'.repeat(3900) })) });
    const rows = Array.from({ length: 25 }, (_, i) => ({ ...row(i), cells: { shop_id: `80000000-0000-4000-8000-${String(i).padStart(12, '0')}`, name: 'New title' } }));
    g.call.mockImplementation(async (name, args) => {
      if (args?.p_mode === 'context') return rows.map(r => ({ rowId: r.rowId, record: { id: r.cells.shop_id, revision: 'a'.repeat(32), publicationStatus: 'draft', hasChanges: true, document: doc, publicationErrors: [] }, candidates: [], truncated: false, conflict: false }));
      if (args?.p_mode === 'validate') expect(new TextEncoder().encode(JSON.stringify(args.p_rows)).length).toBeLessThan(900000);
      return original(name, args);
    });
    const response = await handleImport(request(rows), g); expect(response.status).toBe(200);
    expect((await response.json()).rows).toHaveLength(25);
    expect(g.call.mock.calls.filter(([, args]) => args?.p_mode === 'validate').length).toBeGreaterThan(1);
  });
  it('previews 200 synthetic rows through eight bounded requests with no writer calls', async () => {
    const g = gateway(), start = performance.now();
    const rows = Array.from({ length: 200 }, (_, i) => ({ ...row(i), cells: { name: `Synthetic ${i}`, ...(i % 4 === 1 ? { latitude: '999', longitude: '0' } : {}), ...(i % 4 === 2 ? { country: 'SG', locality: id } : {}) }, fileDuplicates: i % 4 === 3 ? ['duplicate-row'] : [] }));
    const results = [];
    for (let at = 0; at < 200; at += 25) { const response = await handleImport(request(rows.slice(at, at + 25)), g); expect(response.status).toBe(200); expect(response.headers.get('cache-control')).toContain('no-store'); results.push(...(await response.json()).rows); }
    expect(results.filter(r => r.action === 'new_private_draft')).toHaveLength(50);
    expect(results.filter(r => r.action === 'blocked')).toHaveLength(100);
    expect(results.filter(r => r.action === 'review_duplicates')).toHaveLength(50);
    expect(g.call.mock.calls.every(([name]) => ['admin_shop_options', 'admin_import_preview'].includes(name))).toBe(true);
    expect(performance.now() - start).toBeLessThan(10000);
  });
});
