import { describe, expect, it, vi } from 'vitest';
import { handleVerificationPolicy } from './verification-policy-http';
import { AdminForbiddenError } from './http';
import { ShopOperationError } from './shop-http';

const id = '00000000-0000-4000-8000-000000000301';
const revision = 'a'.repeat(32);
const policy = { radiusMeters: 45, custom: false, reason: null, revision };
function gateway(role = 'admin', owner: string | null = id) {
  return { getIdentity: vi.fn(async () => owner), getAccess: vi.fn(async () => ({ role })), listAudit: vi.fn(), call: vi.fn(async () => policy) };
}
function request(body?: unknown, origin = 'https://atlas.test') {
  return new Request(`https://atlas.test/api/v1/admin/shops/${id}/verification-policy`, { method: body ? 'POST' : 'GET',
    ...(body ? { headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}) });
}
describe('private check-in radius administration', () => {
  it('requires cookie identity and an editor/admin role before any policy RPC', async () => {
    for (const g of [gateway('user'), gateway('admin', null)]) {
      expect([401, 403]).toContain((await handleVerificationPolicy(request(), id, g)).status);
      expect(g.call).not.toHaveBeenCalled();
    }
    for (const role of ['admin', 'editor']) {
      const g = gateway(role);
      const r = await handleVerificationPolicy(request(), id, g);
      expect(r.status).toBe(200); expect(r.headers.get('cache-control')).toBe('private, no-store');
      expect(await r.json()).toEqual(policy);
      expect(g.call).toHaveBeenCalledWith('admin_shop_verification_policy', { p_shop: id });
    }
  });
  it('uses a revision-bound default reset and never accepts an actor from the browser', async () => {
    const g = gateway();
    const body = { revision, radiusMeters: null, reason: 'Restoring the verified default' };
    expect((await handleVerificationPolicy(request(body), id, g)).status).toBe(200);
    expect(g.call).toHaveBeenCalledWith('admin_shop_verification_policy', { p_shop: id, p_save: true, p_revision: revision, p_radius: null, p_reason: body.reason });
  });
  it.each([{}, { revision, radiusMeters: 24, reason: 'Validated shop entrance' }, { revision, radiusMeters: 301, reason: 'Validated shop entrance' },
    { revision, radiusMeters: 45.1, reason: 'Validated shop entrance' }, { revision, radiusMeters: '45', reason: 'Validated shop entrance' },
    { revision, radiusMeters: 60, reason: 'short' }, { revision, radiusMeters: 60, reason: 'x'.repeat(501) },
    { revision: 'bad', radiusMeters: 60, reason: 'Validated shop entrance' },
    { revision, radiusMeters: 60, reason: 'Validated shop entrance', actor: id }])('rejects invalid/expanded writes: %j', async body => {
    const g = gateway(); expect((await handleVerificationPolicy(request(body), id, g)).status).toBe(400);
    expect(g.call).not.toHaveBeenCalled();
  });
  it('rejects missing/cross origin, oversize bodies and query parameters', async () => {
    const body = { revision, radiusMeters: 60, reason: 'Validated shop entrance' };
    for (const origin of ['', 'https://other.test']) {
      const g = gateway(); expect((await handleVerificationPolicy(request(body, origin), id, g)).status).toBe(403); expect(g.call).not.toHaveBeenCalled();
    }
    const g = gateway();
    expect((await handleVerificationPolicy(request({ ...body, reason: 'x'.repeat(5000) }), id, g)).status).toBe(400);
    expect((await handleVerificationPolicy(new Request('https://atlas.test/?radius=300'), id, g)).status).toBe(400);
    expect(g.call).not.toHaveBeenCalled();
  });
  it('contains stale writes, role revocation and provider errors', async () => {
    for (const [error, status] of [[new ShopOperationError('PT409'), 409], [new ShopOperationError('40001'), 503], [new AdminForbiddenError(), 403], [Error('private SQL facts'), 503]] as const) {
      const g = gateway(); g.call.mockRejectedValue(error);
      const r = await handleVerificationPolicy(request({ revision, radiusMeters: 60, reason: 'Validated shop entrance' }), id, g);
      expect(r.status).toBe(status); expect(await r.text()).not.toContain('private SQL');
    }
  });
});
