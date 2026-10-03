import AxeBuilder from '@axe-core/playwright';
import { test, expect } from '@playwright/test';
import { stubSession } from '../support/auth';
import { handleImport } from '../../src/server/admin/import-http';
import { handleImportBatch } from '../../src/server/admin/import-batch-http';
import { handleImportPublication } from '../../src/server/admin/import-publication-http';
import { importJobGateway, syntheticCsv } from '../support/import-job';
import type { Page } from '@playwright/test';
async function setup(page: Page, loseResponse = false) {
  await stubSession(page, { kind: 'signed-in' }); const fixture = importJobGateway();
  await page.route('**/api/v1/admin/import**', async route => {
    const req = route.request(), url = new URL(req.url()), body = req.postData();
    const request = new Request(`https://example.test${url.pathname}${url.search}`, { method: req.method(), ...(body ? { body, headers: { origin: 'https://example.test', 'content-type': 'application/json' } } : {}) });
    const response = await (url.pathname.endsWith('/publication') ? handleImportPublication : url.pathname.endsWith('/batches') ? handleImportBatch : handleImport)(request, fixture.gateway);
    if (loseResponse && body && JSON.parse(body).action === 'execute') { loseResponse = false; await route.abort('failed'); return; }
    await route.fulfill({ status: response.status, body: await response.text(), headers: Object.fromEntries(response.headers) });
  });
  await page.goto('/admin/shops/import'); return fixture;
}
async function upload(page: Page, csv: string) {
  await page.getByLabel('CSV or JSON file').setInputFiles({ name: 'synthetic.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
  await expect(page.getByRole('status').filter({ hasText: /rows checked/ })).toBeVisible();
}
test('102 mixed rows: auto-selection, correction CSV, targeted re-upload and accessible table', async ({ page }, info) => {
  const fixture = await setup(page);
  await upload(page, syntheticCsv(102).replace('Synthetic 1,', 'Duplicate shop,').replace('Synthetic 2,', ','));
  await expect(page.getByRole('checkbox')).toHaveCount(102);
  await expect(page.getByText('100 selected', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Select row-1', { exact: true })).toBeDisabled();
  await expect(page.getByLabel('Select row-2', { exact: true })).not.toBeChecked();
  expect(fixture.writes.size).toBe(0);
  await page.getByRole('button', { name: 'Needs fixing (1)', exact: true }).click();
  await expect(page.getByRole('checkbox')).toHaveCount(1);
  const downloaded = page.waitForEvent('download'); await page.getByRole('button', { name: 'Download correction CSV' }).click();
  expect((await downloaded).suggestedFilename()).toContain('corrections.csv');
  await upload(page, 'row_id,name\nrow-2,Corrected synthetic shop');
  await expect(page.getByRole('checkbox')).toHaveCount(102);
  await expect(page.getByLabel('Select row-2', { exact: true })).toBeChecked();
  await expect(page.getByText('101 selected', { exact: true })).toBeVisible();
  await expect(page.locator('body')).toHaveJSProperty('scrollWidth', await page.evaluate(() => window.innerWidth));
  expect((await new AxeBuilder({ page }).include('main').analyze()).violations).toEqual([]);
  await page.getByRole('heading', { name: 'Import job', exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: info.outputPath('admin-import-job-table.png') });
});
test('102 selected drafts: independent failures, lost response recovery and reopen without replay', async ({ page }, info) => {
  test.setTimeout(120000); const fixture = await setup(page, true);
  await upload(page, syntheticCsv(102).replace('Synthetic 2,', 'Fail this row,'));
  await page.getByRole('button', { name: 'Save selected as drafts' }).click();
  await expect(page.getByText('101 imported · 1 remaining', { exact: true })).toBeVisible({ timeout: 90000 });
  await expect(page.getByRole('button', { name: 'Refresh job' })).toBeEnabled();
  expect(fixture.writes.size).toBe(101); expect(fixture.publishWrites.size).toBe(0);
  expect([...fixture.writes.values()].every(n => n === 1)).toBe(true);
  await expect(page.getByRole('checkbox')).toHaveCount(1);
  await expect(page.getByText('Draft validation failed. Correct name and retry.')).toBeVisible();
  await page.screenshot({ path: info.outputPath('admin-import-exceptions.png') });
  await page.reload();
  const id = await page.getByLabel('Reopen job').locator('option').nth(1).getAttribute('value');
  await page.getByLabel('Reopen job').selectOption(id!);
  await expect(page.getByRole('checkbox')).toHaveCount(102);
  expect(fixture.writes.size).toBe(101);
  await upload(page, 'row_id,name\nrow-2,Corrected failure');
  await page.getByRole('button', { name: 'Save selected as drafts' }).click();
  await expect(page.getByText('102 imported · 0 remaining', { exact: true })).toBeVisible();
  expect([...fixture.writes.values()].every(n => n === 1)).toBe(true);
});
test('102 selected publications reuse imported coordinates and keep incomplete rows as drafts', async ({ page }) => {
  test.setTimeout(120000); const fixture = await setup(page);
  await upload(page, syntheticCsv(102).replace('row-2,Synthetic 2,SG,Synthetic City,stationery,Synthetic address', 'row-2,Synthetic 2,SG,Synthetic City,stationery,'));
  await page.getByRole('button', { name: 'Publish selected', exact: true }).click();
  expect(fixture.writes.size).toBe(0);
  await page.getByLabel(/I have checked the selected addresses/).check();
  await page.getByRole('button', { name: 'Confirm and publish selected' }).click();
  await expect(page.getByText('101 published · 1 remaining', { exact: true })).toBeVisible({ timeout: 90000 });
  await expect(page.getByRole('button', { name: 'Refresh job' })).toBeEnabled();
  expect(fixture.writes.size).toBe(102); expect(fixture.publishWrites.size).toBe(101);
  for (const record of fixture.records.values()) expect(record.document.shop).toMatchObject({ latitude: 1.3, longitude: 103.8 });
  await expect(page.getByText(/Add the street address/).first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'Open saved shop' })).toHaveCount(1);
});
test('signed-out and forbidden accounts cannot use import controls', async ({ page }) => {
  await stubSession(page, { kind: 'signed-in' });
  await page.route('**/api/v1/admin/import**', route => route.fulfill({ status: 403, json: { error: { code: 'forbidden' } } }));
  await page.goto('/admin/shops/import');
  await expect(page.getByText(/Bulk import requires a signed-in admin/)).toBeVisible();
  await expect(page.getByLabel('CSV or JSON file')).toHaveCount(0);
  await stubSession(page, { kind: 'signed-out' }); await page.reload();
  await expect(page.getByText('Sign in with your admin account to import shops.')).toBeVisible();
});
