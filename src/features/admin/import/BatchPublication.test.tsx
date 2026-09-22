import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BatchPublication } from './BatchPublication';
import type { Document } from '../shop-contract';
import type { PublicationRow } from './publication-contract';
const row: PublicationRow = { importId: 'i', rowId: 'one', targetId: 's', name: 'Synthetic', slug: 'synthetic', kind: 'private_update', importStatus: 'imported', reviewKey: 'a'.repeat(64), revision: 'revision', positionConfirmed: true, coordinates: { latitude: 0, longitude: 0, address: 'Synthetic address' }, blockers: [], conflict: false, reviewed: false, canReview: true, canConfirm: false, canPublish: false, publication: null };
const doc: Document = { shop: { name: 'Synthetic', opening_hours: { note: 'Saved hours note', entries: [{ day: 'monday', opens: '10:00', closes: '18:00', closed: false }] } }, sources: [], aliases: [], links: [], types: [], services: [], specialties: [], brands: [], experiences: [] };
afterEach(() => vi.unstubAllGlobals());
describe('saved-batch review', () => {
 it('shows saved/public opening-hours differences with shared labels and deselects a freshly inspected row', async () => {
  const fetcher = vi.fn(async (url: string) => Response.json(url.includes('&import=') ? {
   ...row, record: { id: 's', revision: 'new', publicationStatus: 'published', hasChanges: true, document: doc, publicationErrors: [] },
   publicDocument: { ...doc, shop: { ...doc.shop, opening_hours: { note: 'Old hours note', entries: [{ day: 'monday', opens: '09:00', closes: '17:00', closed: false }] } } }, options: {},
  } : { rows: [row], nextOffset: null }));
  vi.stubGlobal('fetch', fetcher);
  render(<BatchPublication batchId="b" blocked={false} onBusyChange={() => {}} />);
  fireEvent.click(screen.getByRole('button', { name: 'Load publication review' }));
  const checkbox = await screen.findByRole('checkbox', { name: 'Synthetic · one' });
  expect(checkbox).not.toBeChecked(); fireEvent.click(checkbox);
  fireEvent.click(screen.getByRole('button', { name: 'Inspect saved / public content for one' }));
  expect(await screen.findByText('Opening hours · Changed')).toBeInTheDocument();
  expect(screen.getByText(/Saved hours note/)).toHaveTextContent('Opens: 10:00');
  expect(screen.getByText(/Old hours note/)).toHaveTextContent('Opens: 09:00');
  expect(checkbox).not.toBeChecked();
 });
 it('stops unknown outcomes and requires reload before any further selection or mutation', async () => {
  vi.stubGlobal('fetch', vi.fn(async (_url: string, init: RequestInit) => {
   if (init.method === 'POST') throw Error('lost');
   return Response.json({ rows: [row], nextOffset: null });
  }));
  render(<BatchPublication batchId="b" blocked={false} onBusyChange={() => {}} />);
  fireEvent.click(screen.getByRole('button', { name: 'Load publication review' }));
  const checkbox = await screen.findByRole('checkbox', { name: 'Synthetic · one' });
  fireEvent.click(checkbox); fireEvent.click(screen.getByRole('button', { name: 'Mark selected reviewed (1)' }));
  await waitFor(() => expect(checkbox).toBeDisabled());
  expect(checkbox).not.toBeChecked();
  fireEvent.click(screen.getByRole('button', { name: 'Reload publication review' }));
  await waitFor(() => expect(checkbox).toBeEnabled());
  expect(checkbox).not.toBeChecked();
 });
});
