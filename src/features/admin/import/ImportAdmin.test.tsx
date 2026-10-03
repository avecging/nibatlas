import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { ImportAdmin } from './ImportAdmin';
import { importJobGateway, syntheticCsv } from '../../../../tests/support/import-job';
import { handleImport } from '../../../server/admin/import-http';
import { handleImportBatch } from '../../../server/admin/import-batch-http';
import { handleImportPublication } from '../../../server/admin/import-publication-http';
vi.mock('@/src/features/account/AccountSessionProvider', () => ({ useAccountSession: () => ({ session: { status: 'signed-in', userId: '70000000-0000-4000-8000-000000000001' } }) }));
afterEach(() => vi.unstubAllGlobals());
function setup(loseResponse = false) {
  const fixture = importJobGateway();
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    const request = new Request(`https://example.test${url}`, { ...init, headers: { 'content-type': 'application/json', origin: 'https://example.test' } });
    const result = await (url.includes('/publication') ? handleImportPublication : url.includes('/batches') ? handleImportBatch : handleImport)(request, fixture.gateway);
    if (loseResponse && init?.body && JSON.parse(String(init.body)).action === 'execute') { loseResponse = false; throw Error('Connection lost'); }
    return result;
  }));
  render(<main><ImportAdmin /></main>); return fixture;
}
async function upload(content: string, name = 'shops.csv') {
  fireEvent.change(await screen.findByLabelText('CSV or JSON file'), { target: { files: [{ name, size: content.length, arrayBuffer: async () => new TextEncoder().encode(content).buffer }] } });
  // A 102-row job is previewed in five deliberately sequential API batches.
  // CI can exceed Testing Library's one-second default while still progressing.
  await screen.findByText(/rows checked/, {}, { timeout: 15_000 });
}
it('shows 102 rows together, auto-selects valid rows, excludes invalid/duplicates and saves directly with partial success', async () => {
  const fixture = setup(true);
  await upload(syntheticCsv(102).replace('Synthetic 1,', 'Duplicate shop,').replace('Synthetic 2,', ',').replace('Synthetic 3,', 'Fail this row,'));
  expect(screen.getAllByRole('main')).toHaveLength(1);
  expect(screen.getAllByRole('checkbox')).toHaveLength(102);
  expect(screen.getByLabelText('Select row-0')).toBeChecked();
  expect(screen.getByLabelText('Select row-1')).toBeDisabled();
  expect(screen.getByLabelText('Select row-2')).not.toBeChecked();
  expect(screen.getByText('100 selected')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Save selected as drafts' }));
  await screen.findByText('99 imported · 3 remaining', {}, { timeout: 60000 });
  expect(fixture.writes.size).toBe(99);
  expect(fixture.publishWrites.size).toBe(0);
  expect([...fixture.writes.values()].every(n => n === 1)).toBe(true);
  expect(screen.queryByLabelText('Select row-0')).not.toBeInTheDocument();
  expect(screen.getByLabelText('Select row-3')).toBeInTheDocument();
  expect(screen.getByText(/Draft validation failed/)).toBeInTheDocument();
}, 75000);
it('merges correction subsets by row_id, selects newly valid rows and retains unchecked rows', async () => {
  setup(); await upload('row_id,name\na,\nb,Existing source\nc,Another source');
  fireEvent.click(screen.getByLabelText('Select b'));
  await upload('row_id,name\na,Corrected', 'corrections.csv');
  expect(screen.getAllByRole('checkbox')).toHaveLength(3);
  expect(screen.getByLabelText('Select a')).toBeChecked();
  expect(screen.getByLabelText('Select b')).not.toBeChecked();
  expect(screen.getByLabelText('Select c')).toBeChecked();
  expect(screen.getAllByText('Existing source').length).toBeGreaterThan(0);
});
it('publishes selected directly with explicit position confirmation and isolates publication blockers', async () => {
  const fixture = setup(); await upload(syntheticCsv(3).replace('row-1,Synthetic 1,SG,Synthetic City,stationery,Synthetic address', 'row-1,Synthetic 1,SG,Synthetic City,stationery,'));
  fireEvent.change(screen.getByLabelText('Find row or shop'), { target: { value: 'Synthetic 0' } });
  expect(screen.queryByText('Synthetic 2')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Publish selected' }));
  const confirmation = screen.getByRole('region', { name: 'Confirm publication' });
  expect(within(confirmation).getByRole('region', { name: 'Selected positions' })).toHaveTextContent('Synthetic 2');
  expect(fixture.writes.size).toBe(0);
  fireEvent.click(screen.getByLabelText(/I have checked every selected address/));
  fireEvent.click(screen.getByRole('button', { name: 'Confirm and publish selected' }));
  await screen.findByText('2 published · 1 remaining');
  expect(fixture.writes.size).toBe(3); expect(fixture.publishWrites.size).toBe(2);
  fireEvent.change(screen.getByLabelText('Find row or shop'), { target: { value: '' } });
  expect(screen.getAllByText(/Add the street address/).length).toBeGreaterThan(0);
  const record = [...fixture.records.values()][0]!;
  expect(record.document.shop).toMatchObject({ latitude: 1.3, longitude: 103.8 });
});
it('does not infer confirmation and can correct an imported draft by row_id without re-importing other rows', async () => {
  const fixture = setup(); await upload(syntheticCsv(2));
  fireEvent.click(screen.getByRole('button', { name: 'Publish selected' }));
  fireEvent.click(screen.getByRole('button', { name: 'Confirm and publish selected' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Refresh job' })).not.toBeDisabled());
  await screen.findByText('0 published · 2 remaining'); expect(fixture.publishWrites.size).toBe(0);
  const target = [...fixture.ledger.values()][0]!.target_id;
  await upload('row_id,name,address_line_1,latitude,longitude\nrow-0,Changed,Synthetic address,-1.2,-103.4');
  expect(screen.getByLabelText('Select row-0')).toBeChecked();
  fireEvent.click(screen.getByRole('button', { name: 'Save selected as drafts' }));
  await screen.findByText('2 imported · 0 remaining');
  expect(fixture.writes.get('row-0')).toBe(2); expect(fixture.writes.get('row-1')).toBe(1);
  expect(fixture.records.get(target)?.document.shop).toMatchObject({ name: 'Changed', latitude: -1.2, longitude: -103.4, country_code: 'SG' });
});
it('shows preserved saved coordinates and directly publishes a correction that omits them', async () => {
  const fixture = setup(); await upload(syntheticCsv(1));
  fireEvent.click(screen.getByRole('button', { name: 'Save selected as drafts' }));
  await screen.findByText('1 imported · 0 remaining');
  await upload('row_id,name\nrow-0,Corrected name only');
  fireEvent.click(screen.getByRole('button', { name: 'Publish selected' }));
  const positions = screen.getByRole('region', { name: 'Selected positions' });
  expect(positions).toHaveTextContent('Synthetic address');
  expect(positions).toHaveTextContent('1.3');
  expect(positions).toHaveTextContent('103.8');
  fireEvent.click(screen.getByLabelText(/I have checked every selected address/));
  fireEvent.click(screen.getByRole('button', { name: 'Confirm and publish selected' }));
  await screen.findByText('1 published · 0 remaining');
  expect(fixture.writes.get('row-0')).toBe(2);
  expect(fixture.publishWrites.size).toBe(1);
});
it('shows preserved coordinates on the first exact-ID update and publishes without re-entry', async () => {
  const fixture = setup(); await upload(syntheticCsv(1));
  fireEvent.click(screen.getByRole('button', { name: 'Save selected as drafts' }));
  await screen.findByText('1 imported · 0 remaining');
  const target = [...fixture.records.keys()][0]!;
  fireEvent.click(screen.getByRole('button', { name: 'Start a new job' }));
  await upload(`row_id,shop_id,name\nupdate-1,${target},First exact-ID update`);
  fireEvent.click(screen.getByRole('button', { name: 'Publish selected' }));
  const positions = screen.getByRole('region', { name: 'Selected positions' });
  expect(positions).toHaveTextContent('Synthetic address');
  expect(positions).toHaveTextContent('1.3');
  expect(positions).toHaveTextContent('103.8');
  fireEvent.click(screen.getByLabelText(/I have checked every selected address/));
  fireEvent.click(screen.getByRole('button', { name: 'Confirm and publish selected' }));
  await screen.findByText('1 published · 0 remaining');
  expect(fixture.writes.get('update-1')).toBe(1);
  expect(fixture.publishWrites.get('update-1')).toBe(1);
});
it('reopens saved outcomes without writes and offers drafts in the same table', async () => {
  const fixture = setup(); await upload(syntheticCsv(2));
  fireEvent.click(screen.getByRole('button', { name: 'Save selected as drafts' }));
  await screen.findByText('2 imported · 0 remaining');
  const select = screen.getByLabelText('Reopen job');
  const id = within(select).getAllByRole('option')[1]!.getAttribute('value');
  fireEvent.click(screen.getByRole('button', { name: 'Start a new job' }));
  fireEvent.change(select, { target: { value: id } });
  await screen.findByText('2 selected');
  expect(fixture.writes.size).toBe(2); expect(screen.getAllByRole('checkbox')).toHaveLength(2);
});
it('retains a rejected filename beside its error and resets the job explicitly', async () => {
  setup(); const input = await screen.findByLabelText('CSV or JSON file');
  fireEvent.change(input, { target: { files: [{ name: 'wrong.jpg', size: 10 }] } });
  expect(await screen.findByRole('alert')).toHaveTextContent('Choose a .csv or .json file.');
  expect(screen.getByText('wrong.jpg')).toBeInTheDocument();
  await upload('row_id,name\na,Synthetic', 'shops.csv');
  fireEvent.click(screen.getByRole('button', { name: 'Start a new job' }));
  expect(screen.getByText('No file chosen')).toBeInTheDocument();
  expect(screen.queryByRole('table')).not.toBeInTheDocument();
});
it('keeps saved targets through correction refresh and restores unchanged saved rows to publish selection', async () => {
  const fixture = setup(); await upload(syntheticCsv(2));
  fireEvent.click(screen.getByRole('button', { name: 'Save selected as drafts' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Refresh job' })).not.toBeDisabled());
  await upload('row_id,name\nrow-0,Changed after import');
  fireEvent.click(screen.getByRole('button', { name: 'Refresh job' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Refresh job' })).not.toBeDisabled());
  expect(screen.getByLabelText('Select row-0')).toBeChecked();
  fireEvent.click(screen.getByRole('button', { name: 'Save selected as drafts' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Refresh job' })).not.toBeDisabled());
  expect(fixture.writes.get('row-0')).toBe(2);
  await upload('row_id,name\nrow-0,Changed after import');
  expect(screen.getByLabelText('Select row-0')).toBeChecked();
  expect(screen.getByRole('button', { name: 'Save selected as drafts' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Publish selected' })).not.toBeDisabled();
});
it('a refreshed edited draft exposes current saved fields before using its new publication binding', async () => {
  const fixture = setup(); await upload(syntheticCsv(1));
  fireEvent.click(screen.getByRole('button', { name: 'Save selected as drafts' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Refresh job' })).not.toBeDisabled());
  const record = [...fixture.records.values()][0]!;
  record.document.shop.website_url = 'https://example.test/current'; record.revision = crypto.randomUUID();
  fixture.publications.clear();
  fireEvent.click(screen.getByRole('button', { name: 'Refresh job' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Refresh job' })).not.toBeDisabled());
  fireEvent.click(screen.getByRole('button', { name: 'All (1)' }));
  const summary = screen.getByText('Inspect current saved fields');
  (summary.parentElement as HTMLDetailsElement).open = true;
  fireEvent(summary.parentElement!, new Event('toggle'));
  await waitFor(() => expect(screen.getByText(/https:\/\/example.test\/current/)).toBeInTheDocument());
});
