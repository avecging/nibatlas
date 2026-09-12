import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ getClaims: vi.fn(), rpc: vi.fn() }));
vi.mock('@/src/server/supabase/server-client', () => ({ createSupabaseServerClient: async () => ({ auth: { getClaims: mocks.getClaims }, rpc: mocks.rpc }) }));
import { adminReadRoute } from './route-context';
beforeEach(() => vi.clearAllMocks());
it('uses verified identity and the cookie-bound live-role RPC, never metadata role', async () => {
  mocks.getClaims.mockResolvedValue({ data: { claims: { sub: '10000000-0000-4000-8000-000000000001', user_metadata: { role: 'admin' } } }, error: null });
  mocks.rpc.mockResolvedValue({ data: null, error: { code: '42501', message: 'private' } });
  const r = await adminReadRoute(new Request('https://nibatlas.test/api/v1/admin/access'), 'access');
  expect(r.status).toBe(403); expect(mocks.rpc).toHaveBeenCalledWith('admin_access', undefined);
});
it('rejects failed claims without calling role or audit RPCs', async () => {
  mocks.getClaims.mockResolvedValue({ data: null, error: { message: 'expired' } });
  expect((await adminReadRoute(new Request('https://nibatlas.test/api/v1/admin/audit'), 'audit')).status).toBe(401);
  expect(mocks.rpc).not.toHaveBeenCalled();
});
