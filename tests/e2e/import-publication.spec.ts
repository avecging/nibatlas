import AxeBuilder from '@axe-core/playwright';
import { test, expect } from '@playwright/test';
import { stubSession } from '../support/auth';
import { handleImportPublication } from '../../src/server/admin/import-publication-http';
import type { ShopAdminGateway } from '../../src/server/admin/shop-http';
import type { PublicationRow } from '../../src/features/admin/import/publication-contract';
const batch = 'b3000000-0000-4000-8000-000000000001';
const uuid = (i: number) => `b4000000-0000-4000-8000-${String(i).padStart(12, '0')}`;

test('200 saved C2 rows: selected review, confirmation, partial failure, lost response and reload', async ({ page }, testInfo) => {
 test.setTimeout(180000);
 await stubSession(page, { kind: 'signed-in' });
 const rows: PublicationRow[] = Array.from({ length: 200 }, (_, i) => ({
  importId: uuid(i), targetId: uuid(i), rowId: `row-${i}`, name: `Synthetic ${i}`, slug: `synthetic-${i}`,
  kind: i === 10 ? 'private_update' : 'new_draft', importStatus: 'imported', reviewKey: 'a'.repeat(64), revision: uuid(i), positionConfirmed: false,
  coordinates: { latitude: 0, longitude: 0, address: i === 2 ? null : 'Synthetic address' },
  blockers: [...(i === 2 ? ['Add the street address.'] : []), 'Check and confirm the saved shop position.'],
  conflict: false, reviewed: false, canReview: true, canConfirm: false, canPublish: false, publication: null,
 }));
 const writes = new Map<string, number>(), readOffsets: number[] = [];
 let loseResponse = true, failOnce = true;
 const gateway: ShopAdminGateway = { getIdentity: async () => batch, getAccess: async () => ({ role: 'admin' }), listAudit: async () => [], call: async (name, args) => {
  if (name === 'admin_import_publication_read') {
   const offset = Number(args?.p_offset); readOffsets.push(offset);
   return { rows: structuredClone(rows.slice(offset, offset + 25)), nextOffset: offset + 25 < rows.length ? offset + 25 : null };
  }
  const row = rows.find(r => r.importId === args?.p_import)!;
  if (args?.p_action === 'review') {
   row.reviewed = true; row.canConfirm = !row.positionConfirmed; row.conflict = false;
   row.publication = { id: String(args.p_operation), status: 'reviewed', review_key: row.reviewKey!, expected_revision: row.revision!, position_confirmed: row.positionConfirmed, reason: null, created_at: '2026-09-22T00:00:00Z', published_at: null };
  } else if (args?.p_action === 'confirm_position') {
   row.positionConfirmed = true; row.canConfirm = false; row.blockers = row.blockers.filter(b => b !== 'Check and confirm the saved shop position.'); row.canPublish = !row.blockers.length;
  } else if (args?.p_action === 'publish') {
   if (row.rowId === 'row-3' && failOnce) { failOnce = false; row.publication!.status = 'failed'; row.publication!.reason = 'Synthetic transient failure. Retry this row.'; }
   else if (row.publication!.status !== 'published') { row.publication!.status = 'published'; row.publication!.published_at = '2026-09-22T00:01:00Z'; row.canPublish = false; row.canReview = false; row.kind = 'already_published'; writes.set(row.rowId, (writes.get(row.rowId) ?? 0) + 1); }
  }
  return structuredClone(row);
 } };
 await page.route('**/api/v1/admin/import**', async route => {
  const req = route.request(), url = new URL(req.url()), body = req.postData();
  if (url.pathname.endsWith('/publication')) {
   const response = await handleImportPublication(new Request(`https://example.test${url.pathname}${url.search}`, { method: req.method(), ...(body ? { body, headers: { origin: 'https://example.test', 'content-type': 'application/json' } } : {}) }), gateway);
   if (body && JSON.parse(body).action === 'publish' && loseResponse) { loseResponse = false; await route.abort('failed'); return; }
   await route.fulfill({ status: response.status, body: await response.text(), headers: Object.fromEntries(response.headers) }); return;
  }
  const data = url.pathname.endsWith('/batches') ? url.searchParams.has('batch') ? { id: batch, operations: rows.map(r => ({ id: r.importId, row_id: r.rowId, target_id: r.targetId, operation_revision: 1, status: 'imported', preview: null, patch: null, review_key: r.reviewKey, reason: null })) } : [{ id: batch, createdAt: '2026-09-22T00:00:00Z', expiresAt: '2026-10-22T00:00:00Z', rows: 200 }] : { options: { localities: [], types: [], brands: [], specialties: [], services: [] } };
  await route.fulfill({ json: data });
 });
 const open = async () => {
  await page.getByLabel('Reopen batch').selectOption(batch);
  await page.getByRole('button', { name: 'Load publication review', exact: true }).click();
  await expect(page.getByText('Loaded 200 saved rows. Select only the rows you intend to review or publish.')).toBeVisible();
 };
 const selectPages = async () => {
  for (let i = 0; i < 8; i++) {
   await page.getByRole('button', { name: 'Select reviewable rows on this page' }).click();
   if (i < 7) await page.getByRole('button', { name: 'Next review rows', exact: true }).click();
  }
  for (let i = 0; i < 7; i++) await page.getByRole('button', { name: 'Previous review rows', exact: true }).click();
 };
 await page.goto('/admin/shops/import'); await open();
 expect(readOffsets).toEqual([0,25,50,75,100,125,150,175]);
 await expect(page.getByRole('button', { name: 'Publish selected rows (0)' })).toBeDisabled();
 await selectPages();
 await page.getByRole('checkbox', { name: 'Synthetic 1 · row-1', exact: true }).uncheck();
 await page.getByRole('button', { name: 'Mark selected reviewed (199)' }).click();
 await expect(page.getByText(/Review finished: 199 successful/)).toBeVisible();
 expect(rows[1]!.reviewed).toBe(false);
 await page.getByRole('button', { name: 'Confirm selected positions (199)' }).click();
 await expect(page.getByRole('region', { name: 'Confirm saved positions' })).toContainText('0, 0');
 expect(rows[0]!.positionConfirmed).toBe(false);
 await page.getByRole('button', { name: 'I have checked these saved positions' }).click();
 await expect(page.getByText(/Position confirmation finished: 199 successful/)).toBeVisible();
 await expect(page.getByRole('button', { name: 'Publish selected rows (198)' })).toBeDisabled();
 await expect(page.getByLabel('Blockers for row-2')).toContainText('Add the street address.');
 await page.getByRole('checkbox', { name: 'Synthetic 2 · row-2', exact: true }).uncheck();
 await page.getByRole('button', { name: 'Publish selected rows (198)' }).click();
 await expect(page.getByRole('region', { name: 'Confirm selected publication' })).toContainText('Publish exactly 198 selected shops?');
 expect(writes.size).toBe(0);
 await page.getByRole('button', { name: 'Cancel publication action' }).click();
 await page.getByRole('button', { name: 'Publish selected rows (198)' }).click();
 await page.getByRole('button', { name: 'Confirm publication of selected rows' }).click();
 await expect.poll(() => writes.size).toBe(1);
 await page.reload(); await open();
 await expect(page.getByRole('checkbox', { name: 'Synthetic 0 · row-0', exact: true })).toBeDisabled();
 await selectPages();
 await page.getByRole('checkbox', { name: 'Synthetic 1 · row-1', exact: true }).uncheck();
 await page.getByRole('checkbox', { name: 'Synthetic 2 · row-2', exact: true }).uncheck();
 await page.getByRole('button', { name: 'Publish selected rows (197)' }).click();
 await page.getByRole('button', { name: 'Confirm publication of selected rows' }).click();
 await expect(page.getByText(/Publication finished: 196 successful, 1 need attention/)).toBeVisible();
 expect(writes.size).toBe(197);
 await expect(page.getByText('1 selected', { exact: true })).toBeVisible();
 await page.getByRole('button', { name: 'Publish selected rows (1)' }).click();
 await page.getByRole('button', { name: 'Confirm publication of selected rows' }).click();
 await expect(page.getByText(/Publication finished: 1 successful, 0 need attention/)).toBeVisible();
 expect(writes.size).toBe(198); expect([...writes.values()].every(n => n === 1)).toBe(true);
 expect(writes.has('row-1')).toBe(false); expect(writes.has('row-2')).toBe(false);
 await page.getByLabel('Filter saved review rows').selectOption('published');
 await page.getByLabel('Search saved review rows').fill('Synthetic 0');
 await expect(page.getByRole('link', { name: 'Public page for Synthetic 0', exact: true })).toBeVisible();
 await expect(page.locator('body')).toHaveJSProperty('scrollWidth', await page.evaluate(() => window.innerWidth));
 expect((await new AxeBuilder({ page }).include('main').analyze()).violations).toEqual([]);
 await page.getByRole('heading', { name: '6. Review and publish saved rows' }).scrollIntoViewIfNeeded();
 await page.screenshot({ path: testInfo.outputPath('c3-publication-results.png') });
});
