import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { ShopVerificationPolicy } from './ShopVerificationPolicy';

const shop = '00000000-0000-4000-8000-000000000301';
const policy = { radiusMeters: 45, custom: false, reason: null, revision: 'a'.repeat(32) };
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });
it('loads, validates, saves a custom radius, and restores default with a reason', async () => {
  const writes: Record<string, unknown>[] = [];
  const fetch = vi.fn(async (_url: string, init?: RequestInit) => {
    if (!init?.body) return Response.json(policy);
    const body = JSON.parse(String(init.body)); writes.push(body);
    return Response.json({ ...policy, radiusMeters: body.radiusMeters ?? 45, custom: body.radiusMeters !== null, reason: body.radiusMeters !== null ? body.reason.trim() : null, revision: 'b'.repeat(32) });
  });
  vi.stubGlobal('fetch', fetch); render(<ShopVerificationPolicy shop={shop} disabled={false} />);
  await waitFor(() => expect(screen.getByRole('button', { name: 'Save check-in radius' })).toBeEnabled());
  fireEvent.change(screen.getByLabelText('Radius setting'), { target: { value: 'custom' } });
  fireEvent.change(screen.getByLabelText('Radius in metres'), { target: { value: '60' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save check-in radius' }));
  expect(screen.getByRole('alert')).toHaveTextContent('10–500'); expect(writes).toHaveLength(0);
  fireEvent.change(screen.getByLabelText('Reason for this change'), { target: { value: 'Shop entrance checked in this mall' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save check-in radius' }));
  await screen.findByText('Check-in radius saved. This applies immediately.');
  expect(writes[0]).toMatchObject({ radiusMeters: 60, revision: policy.revision });
  fireEvent.change(screen.getByLabelText('Radius setting'), { target: { value: 'default' } });
  expect(screen.getByLabelText('Reason for this change')).toHaveValue('');
  fireEvent.change(screen.getByLabelText('Reason for this change'), { target: { value: 'Restoring the verified default' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save check-in radius' }));
  await waitFor(() => expect(writes).toHaveLength(2));
  expect(writes[1]).toMatchObject({ radiusMeters: null, revision: 'b'.repeat(32) });
});
it('blocks stale saves until reloaded and preserves the on-screen reason', async () => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => init?.body
    ? Response.json({ ok: false, error: { code: 'revision_conflict' } }, { status: 409 }) : Response.json(policy)));
  render(<ShopVerificationPolicy shop={shop} disabled={false} />);
  await waitFor(() => expect(screen.getByRole('button', { name: 'Save check-in radius' })).toBeEnabled());
  fireEvent.change(screen.getByLabelText('Reason for this change'), { target: { value: 'Restoring the verified default' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save check-in radius' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('another session');
  expect(screen.getByRole('button', { name: 'Save check-in radius' })).toBeDisabled();
  expect(screen.getByLabelText('Reason for this change')).toHaveValue('Restoring the verified default');
  fireEvent.click(screen.getByRole('button', { name: 'Reload saved radius' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Save check-in radius' })).toBeEnabled());
});
it('discards callbacks on unmount', async () => {
  let resolve: (response: Response) => void = () => {};
  vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(r => { resolve = r; })));
  const view = render(<ShopVerificationPolicy shop={shop} disabled />);
  view.unmount(); await act(async () => resolve(Response.json(policy)));
  expect(screen.queryByText('Check-in radius')).not.toBeInTheDocument();
});

it('keeps saved controls disabled while the shop has unsaved edits',async()=>{
  const fetch=vi.fn(async()=>Response.json(policy));vi.stubGlobal('fetch',fetch);
  render(<ShopVerificationPolicy shop={shop} disabled />);
  await waitFor(()=>expect(screen.queryByText('Loading or saving the check-in radius…')).not.toBeInTheDocument());
  expect(screen.getByRole('button',{name:'Save check-in radius'})).toBeDisabled();
  fireEvent.click(screen.getByRole('button',{name:'Save check-in radius'}));expect(fetch).toHaveBeenCalledTimes(1);
});
