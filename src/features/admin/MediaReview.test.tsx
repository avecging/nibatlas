// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { MediaReview } from './MediaReview';
import { document, type ShopRecord } from './shop-contract';
import { comparisonMedia } from './media-review';
import type { ShopMedia } from './media-contract';

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
function install({shopReads = [record], status = 200, malformed = false}: {shopReads?: ShopRecord[]; status?: number; malformed?: boolean} = {}) {
  let reads = 0;
  const fetch = vi.fn(async (path: string) => new Response(JSON.stringify(path.endsWith('/media')
    ? {entries:malformed ? [{id:'invalid'}] : media} : path.endsWith('/stamp') ? {entries:[stamp(6,true),stamp(7,false),stamp(8,false,false)]}
      : shopReads[Math.min(reads++, shopReads.length - 1)]), {status}));
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
  expect(fetch).toHaveBeenCalledTimes(4);
  for (const [,init] of fetch.mock.calls as unknown as [string,RequestInit][]) {
    expect(init.method).toBeUndefined();expect(init.cache).toBe('no-store');expect(init.credentials).toBe('same-origin');
  }
});

it.each(['before','during'])('refuses a shop changed %s the separate media reads', async when => {
  const changed = {...record,revision:'b'.repeat(32)};
  install({shopReads:when === 'before' ? [changed] : [record,changed]});render(view());
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

it('does not reveal partial results if stamp reads fail after media succeeds', async () => {
  const fetch = install();const implementation = fetch.getMockImplementation()!;
  fetch.mockImplementation(path => path.endsWith('/stamp') ? Promise.resolve(new Response(null,{status:403})) : implementation(path));
  render(view());await screen.findByRole('alert');expect(screen.queryByText('Synthetic photo 2')).toBeNull();
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
