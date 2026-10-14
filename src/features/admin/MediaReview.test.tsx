// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { MediaReview } from './MediaReview';
import { document, type ShopRecord } from './shop-contract';
import { comparisonMedia } from './media-review';
import type { ShopMedia } from './media-contract';
import type { SavedReview } from './review-contract';

const id = '61000000-0000-4000-8000-000000000001';
const revision = 'a'.repeat(32);
const uuid = (n: number) => `61000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const record: ShopRecord = {id, revision, publicationStatus:'draft', publicationErrors:[], hasChanges:true,
  document:document({shop:{name:'Synthetic review shop', slug:'synthetic-review-shop', source_quality:'demo', operational_status:'unknown', position_precision:'street'}, sources:[], aliases:[], links:[], services:[], specialties:[], brands:[], types:[]})};
const photo = (n: number, status: 'draft' | 'approved', kind: 'photo' | 'logo' = 'photo'): ShopMedia => ({id:uuid(n), kind, width:4, height:3,
  altText:`Synthetic ${kind} ${n}`, creditText:null, status, revision, caption:`Caption ${n}`});
const media = [photo(2,'draft'), photo(3,'approved'), photo(4,'approved','logo'), photo(5,'draft','logo')];
const stamp = (n: number, active: boolean, hasArtwork = true) => ({id:uuid(n), stampId:uuid(9), designVersion:n, kind:'uploaded', origin:'founder_created', status:active?'approved':'draft',
  ink:'teal', creatorName:'Synthetic Artist', creatorUrl:null, active, hasArtwork, revision});
function install({shopReads = [record], status = 200, malformed = false, saved = null}: {shopReads?: ShopRecord[]; status?: number; malformed?: boolean; saved?: SavedReview|null} = {}) {
  let review = saved;
  const fetch = vi.fn(async (_path: string, init?: RequestInit) => {
    if (init?.method === 'POST') {
      const body = JSON.parse(String(init.body));
      review = {id:body.id, choices:body.choices, current:true, reviewedAt:'2026-09-28T09:00:00Z'};
    }
    return new Response(JSON.stringify({record:shopReads.at(-1), media:malformed ? [{id:'invalid'}] : media,
      stamps:[stamp(6,true),stamp(7,false),stamp(8,false,false)],availableStampIds:[uuid(6),uuid(7)],reviewKey:'b'.repeat(64),conflict:false,review}),{status});
  });
  vi.stubGlobal('fetch',fetch);
  return fetch;
}
function view(value = record) { return <MediaReview record={value} localityName="" onOpenPhotos={vi.fn()} onOpenStamp={vi.fn()}/>; }
afterEach(() => {cleanup();vi.unstubAllGlobals();});

it('compares saved private photos, exactly one logo and intact stamp previews without any writes', async () => {
  const fetch = install();render(view());
  await screen.findByRole('group',{name:'Photos to compare'});
  const gallery = within(screen.getByLabelText('Selected gallery comparison'));
  expect(gallery.getByRole('button',{name:/Open photo 1 of 1: Synthetic photo 3/})).toBeTruthy();
  const current = screen.getByRole('checkbox',{name:/Synthetic photo 3/});
  expect(current).toBeChecked();expect(current).toBeDisabled();
  expect(screen.getByText('Synthetic photo 3 · Approved, shop not public')).toBeTruthy();
  fireEvent.click(screen.getByRole('checkbox',{name:/Synthetic photo 2/}));
  expect(gallery.getByRole('button',{name:/Open photo 1 of 2: Synthetic photo 2/})).toBeTruthy();
  fireEvent.click(screen.getByRole('radio',{name:/Synthetic logo 5/}));
  expect(gallery.getByRole('img',{name:'Synthetic logo 5'})).toHaveAttribute('src',`/api/v1/admin/shops/${id}/media/${uuid(5)}`);
  expect(gallery.queryByRole('img',{name:'Synthetic logo 4'})).toBeNull();
  fireEvent.click(screen.getByRole('radio',{name:/Design v7/}));
  const selectedStamp = within(screen.getByLabelText('Selected stamp comparison'));
  for (const image of selectedStamp.getAllByRole('img')) expect(image).toHaveAttribute('src',`/api/v1/admin/shops/${id}/stamp/${uuid(7)}`);
  expect(selectedStamp.getByText('created by: Synthetic Artist')).toBeTruthy();
  expect(screen.getByRole('radio',{name:/Design v8/})).toBeDisabled();
  expect(fetch).toHaveBeenCalledTimes(1);
  for (const [,init] of fetch.mock.calls as unknown as [string,RequestInit][]) {
    expect(init.method).toBeUndefined();expect(init.cache).toBe('no-store');expect(init.credentials).toBe('same-origin');
  }
});

it('refuses an atomic review snapshot for a different saved shop revision', async () => {
  const changed = {...record,revision:'b'.repeat(32)};
  install({shopReads:[changed]});render(view());
  expect(await screen.findByRole('alert')).toHaveTextContent('saved shop has changed');
  expect(screen.queryByRole('group',{name:'Photos to compare'})).toBeNull();
});

it.each([401,403,503])('fails closed on %s without partially displaying private media', async status => {
  install({status});render(view());await screen.findByRole('alert');
  expect(screen.queryByRole('img')).toBeNull();expect(screen.queryByRole('group',{name:'Photos to compare'})).toBeNull();
});

it('rejects malformed media and recovers on deliberate reload', async () => {
  install({malformed:true});render(view());await screen.findByRole('alert');
  install();fireEvent.click(screen.getByRole('button',{name:'Reload media comparison'}));
  await screen.findByRole('group',{name:'Photos to compare'});
});

it('drops choices on reload and a new shop revision, without carrying old media into the loading state', async () => {
  install();const rendered = render(view());
  fireEvent.click(await screen.findByRole('checkbox',{name:/Synthetic photo 2/}));
  fireEvent.click(screen.getByRole('button',{name:'Reload media comparison'}));
  expect(screen.queryByRole('checkbox',{name:/Synthetic photo 2/})).toBeNull();
  expect(await screen.findByRole('checkbox',{name:/Synthetic photo 2/})).not.toBeChecked();
  fireEvent.click(screen.getByRole('checkbox',{name:/Synthetic photo 2/}));
  const changed = {...record,revision:'b'.repeat(32)};install({shopReads:[changed]});rendered.rerender(view(changed));
  expect(screen.queryByRole('checkbox',{name:/Synthetic photo 2/})).toBeNull();
  expect(await screen.findByRole('checkbox',{name:/Synthetic photo 2/})).not.toBeChecked();
});

it('omits rejected and unselected media while retaining saved order', () => {
  expect(comparisonMedia([...media,{...photo(10,'draft'),status:'rejected'}], [uuid(2),uuid(10)],uuid(5)).map(m => m.id)).toEqual([uuid(2),uuid(3),uuid(5)]);
});

it('clears a failed cover when the selected photos change', async () => {
  install();render(view());
  const checkbox = await screen.findByRole('checkbox',{name:/Synthetic photo 2/});
  fireEvent.click(checkbox);
  const gallery = within(screen.getByLabelText('Selected gallery comparison'));
  const cover = gallery.getByRole('button',{name:/Open photo 1 of 2: Synthetic photo 2/});
  fireEvent.error(cover.querySelector('img')!);
  expect(gallery.getByText('Photo unavailable')).toBeTruthy();
  fireEvent.click(checkbox);
  expect(gallery.queryByText('Photo unavailable')).toBeNull();
  expect(gallery.getByRole('button',{name:/Open photo 1 of 1: Synthetic photo 3/}).querySelector('img')).toHaveAttribute('src',`/api/v1/admin/shops/${id}/media/${uuid(3)}`);
});

it('saves only on explicit action, restores choices after unmount and does not publish', async () => {
  const fetch = install(); const rendered = render(view());
  fireEvent.click(await screen.findByRole('checkbox',{name:/Synthetic photo 2/}));
  fireEvent.click(screen.getByRole('radio',{name:/Synthetic logo 5/}));
  fireEvent.click(screen.getByRole('radio',{name:/Design v7/}));
  expect(fetch).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole('button',{name:'Save reviewed choices'}));
  await screen.findByText('Reviewed choices saved. Nothing was published or activated.');
  expect(screen.getByRole('button',{name:'Save reviewed choices'})).toBeDisabled();
  const posted = JSON.parse(String(fetch.mock.calls[1]![1]!.body));
  expect(posted).toMatchObject({previousId:null, reviewKey:'b'.repeat(64), choices:{photos:[uuid(2)],logo:uuid(5),stamp:uuid(7)}});
  expect(fetch.mock.calls[1]![0]).toBe(`/api/v1/admin/shops/${id}/review`);
  rendered.unmount(); render(view());
  expect(await screen.findByRole('checkbox',{name:/Synthetic photo 2/})).toBeChecked();
  expect(screen.getByRole('radio',{name:/Synthetic logo 5/})).toBeChecked();
  expect(screen.getByRole('radio',{name:/Design v7/})).toBeChecked();
  expect(screen.getByRole('button',{name:'Save reviewed choices'})).toBeDisabled();
  fireEvent.click(screen.getByRole('radio',{name:'No logo in comparison'}));
  expect(screen.getByRole('button',{name:'Save reviewed choices'})).toBeEnabled();
});
it('remembers stale choices but requires explicit re-review against the new server key', async () => {
  const saved = {id:uuid(20),choices:{photos:[uuid(2)],logo:uuid(5),stamp:uuid(7)},reviewedAt:'2026-09-27T09:00:00Z',current:false};
  const fetch = install({saved}); render(view());
  expect(await screen.findByRole('checkbox',{name:/Synthetic photo 2/})).toBeChecked();
  expect(screen.getByText(/Review again: saved content has changed/)).toBeTruthy();
  fireEvent.click(screen.getByRole('button',{name:'Save reviewed choices'}));
  await screen.findByText('Reviewed choices saved. Nothing was published or activated.');
  expect(JSON.parse(String(fetch.mock.calls[1]![1]!.body)).previousId).toBe(saved.id);
});
it.each([409,503,403])('requires reload after a %s save without pretending it succeeded', async status => {
  const fetch = install(); render(view());
  await screen.findByRole('group',{name:'Photos to compare'});
  fetch.mockResolvedValueOnce(new Response(null,{status}));
  fireEvent.click(screen.getByRole('button',{name:'Save reviewed choices'}));
  await screen.findByRole('alert');
  expect(screen.getByRole('button',{name:'Save reviewed choices'})).toBeDisabled();
  expect(screen.queryByText('Reviewed choices saved. Nothing was published or activated.')).toBeNull();
});
it('keeps unavailable saved IDs explicit until deliberately cleared, never substitutes approved defaults', async () => {
  install({saved:{id:uuid(20),choices:{photos:[uuid(99)],logo:uuid(98),stamp:uuid(97)},current:false,reviewedAt:'2026-09-27T09:00:00Z'}});
  render(view()); await screen.findByRole('alert');
  expect(screen.getByRole('radio',{name:/Synthetic logo 4/})).not.toBeChecked();
  expect(screen.getByRole('button',{name:'Save reviewed choices'})).toBeDisabled();
  fireEvent.click(screen.getByRole('button',{name:'Clear unavailable choices'}));
  expect(screen.getByRole('button',{name:'Save reviewed choices'})).toBeEnabled();
  expect(screen.getByRole('radio',{name:'No logo in comparison'})).toBeChecked();
});
it('aborts an in-flight save on account-keyed unmount', async () => {
  const fetch = install(); const rendered = render(view());
  await screen.findByRole('group',{name:'Photos to compare'});
  fetch.mockImplementationOnce(async () => new Promise<Response>(() => {}));
  fireEvent.click(screen.getByRole('button',{name:'Save reviewed choices'}));
  const signal = fetch.mock.calls[1]![1]!.signal;
  expect(signal?.aborted).toBe(false);
  rendered.unmount(); expect(signal?.aborted).toBe(true);
});
