import AxeBuilder from '@axe-core/playwright';
import { test, expect } from '@playwright/test';
import { stubSession } from '../support/auth';
import { handleImport } from '../../src/server/admin/import-http';
import { handleImportBatch } from '../../src/server/admin/import-batch-http';
import type { ShopAdminGateway } from '../../src/server/admin/shop-http';
import type { ImportOperation, PreviewRow } from '../../src/features/admin/import/contract';
const user = '77000000-0000-4000-8000-000000000001', key = 'a'.repeat(64);
test('200 rows: selected private import, lost response, reload and durable resume', async ({ page }, testInfo) => {
 test.setTimeout(120000);
 await stubSession(page, { kind: 'signed-in' });
 const ledger = new Map<string, ImportOperation>(), writes = new Map<string, number>();
 let batchId = '', loseResponse = true;
 const gateway: ShopAdminGateway = { getIdentity: async () => user, getAccess: async () => ({ role: 'admin' }), listAudit: async () => [], call: async (name, args) => {
  if (name === 'admin_shop_options') return { localities: [], types: [], brands: [], specialties: [], services: [] };
  if (name === 'admin_import_preview') {
   const rows = args!.p_rows as { rowId: string }[];
   return args?.p_mode === 'context' ? rows.map(r => ({ rowId: r.rowId, record: null, candidates: [], truncated: false, conflict: false })) : rows.map(r => ({ rowId: r.rowId, issues: [], publicationErrors: ['Confirm location later'], reviewKey: key }));
  }
  if (name === 'admin_import_batches') return args?.p_batch ? { id: batchId, operations: [...ledger.values()] } : batchId ? [{ id: batchId, createdAt: '2026-09-21T00:00:00Z', expiresAt: '2026-10-21T00:00:00Z', rows: ledger.size }] : [];
  if (name === 'admin_import_operation_read') return ledger.get(String(args?.p_operation));
  if (name === 'admin_import_operation') {
   const id = String(args?.p_operation), payload = args?.p_payload as Record<string, unknown>;
   if (args?.p_action === 'review') {
    batchId = String(args.p_batch);
    if (!ledger.has(id)) ledger.set(id, { id, row_id: (payload.preview as PreviewRow).rowId, operation_revision: 1, target_id: String(payload.targetId), review_key: key, patch: payload.row as ImportOperation['patch'], preview: payload.preview as PreviewRow, status: 'ready', reason: null });
   } else {
    const op = ledger.get(id)!;
    if (op.status === 'ready') { op.status = op.row_id === 'row-2' ? 'conflicted' : 'imported'; op.reason = op.status === 'conflicted' ? 'Changed record; review again.' : null; if (op.status === 'imported') writes.set(op.row_id, (writes.get(op.row_id) ?? 0) + 1); }
   }
   const op = ledger.get(id)!; return { id, rowId: op.row_id, status: op.status, reason: op.reason, targetId: op.target_id };
  }
  throw Error(`Unexpected RPC ${name}`);
 } };
 await page.route('**/api/v1/admin/import**', async route => {
  const req = route.request(), url = new URL(req.url()), body = req.postData();
  const request = new Request(`https://example.test${url.pathname}${url.search}`, { method: req.method(), ...(body ? { body, headers: { origin: 'https://example.test', 'content-type': 'application/json' } } : {}) });
  const response = url.pathname.endsWith('/batches') ? await handleImportBatch(request, gateway) : await handleImport(request, gateway);
  if (body && JSON.parse(body).action === 'execute' && loseResponse) { loseResponse = false; await route.abort('failed'); return; }
  await route.fulfill({ status: response.status, body: await response.text(), headers: Object.fromEntries(response.headers) });
 });
 await page.goto('/admin/shops/import');
 await page.getByLabel('CSV or JSON file').setInputFiles({ name: 'synthetic.csv', mimeType: 'text/csv', buffer: Buffer.from('row_id,name\n' + Array.from({ length: 200 }, (_, i) => `row-${i},Synthetic ${i}`).join('\n')) });
 await page.getByRole('button', { name: 'Run dry-run preview' }).click();
 await expect(page.getByRole('button', { name: 'Select all eligible rows (200)' })).toBeVisible();
 await page.getByRole('button', { name: 'Select all eligible rows (200)' }).click();
 await page.getByRole('button', { name: 'Review selected rows' }).click();
 await expect(page.getByRole('region', { name: 'Confirm private import' })).toContainText('200 new shops and 0 private updates');
 await page.getByRole('region', { name: 'Confirm private import' }).scrollIntoViewIfNeeded();
 await page.screenshot({ path: testInfo.outputPath('admin-private-import-confirm.png') });
 expect(writes.size).toBe(0);
 await page.getByRole('button', { name: 'Cancel', exact: true }).click();
 await page.getByRole('checkbox', { name: 'Synthetic 1 · row-1 · New draft', exact: true }).uncheck();
 await page.getByRole('button', { name: 'Review selected rows' }).click();
 await expect(page.getByRole('region', { name: 'Confirm private import' })).toContainText('199 new shops and 0 private updates');
 await page.getByRole('button', { name: 'Import selected as drafts', exact: true }).click();
 await expect.poll(() => writes.size).toBe(1);
 await page.reload();
 await expect(page.getByLabel('Reopen batch')).toContainText('200 rows');
 await page.getByLabel('Reopen batch').selectOption(batchId);
 await expect(page.getByText(/1 imported · 0 conflicted/)).toBeVisible();
 await page.getByRole('button', { name: 'Review remaining import' }).click();
 await expect(page.getByRole('region', { name: 'Confirm private import' })).toContainText('199 new shops and 0 private updates');
 await page.getByRole('button', { name: 'Import selected as drafts', exact: true }).click();
 await expect(page.getByText('Import finished. Review each result below. Nothing was published.')).toBeVisible();
 expect(writes.size).toBe(199); expect([...writes.values()].every(n => n === 1)).toBe(true);
 await expect(page.getByText(/199 imported · 1 conflicted/)).toBeVisible();
 await page.getByRole('button', { name: 'Run dry-run preview' }).click();
 await expect(page.getByRole('button', { name: 'Select all eligible rows (1)' })).toBeVisible();
 await expect(page.locator('body')).toHaveJSProperty('scrollWidth', await page.evaluate(() => window.innerWidth));
 expect((await new AxeBuilder({ page }).include('main').analyze()).violations).toEqual([]);
 await page.getByRole('heading', { name: /Saved batch/ }).scrollIntoViewIfNeeded();
 await page.screenshot({ path: testInfo.outputPath('admin-private-import-resume.png') });
 await page.getByRole('button', { name: 'Start a separate new batch' }).click();
 await expect(page.getByRole('heading', { name: /Saved batch/ })).toHaveCount(0);
 await expect(page.getByRole('button', { name: 'Import selected as drafts', exact: true })).toHaveCount(0);
});
