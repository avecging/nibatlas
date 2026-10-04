import { UUID } from '@/src/features/admin/shop-contract';
import { decodeVerificationPolicy } from '@/src/features/admin/verification-policy';
import { authorizeAdmin, AdminForbiddenError, adminFailure } from './http';
import { ADMIN_HEADERS, ShopOperationError, type ShopAdminGateway } from './shop-http';

export async function handleVerificationPolicy(request: Request, shop: string, gateway: ShopAdminGateway) {
  const json = (value: unknown, status = 200) => Response.json(value, { status, headers: ADMIN_HEADERS });
  try {
    const role = await authorizeAdmin(gateway, 'editor');
    if (role instanceof Response) return role;
    if (!UUID.test(shop) || new URL(request.url).search || !['GET', 'POST'].includes(request.method)) return adminFailure('invalid_request');
    const args: Record<string, unknown> = { p_shop: shop };
    if (request.method === 'POST') {
      if (request.headers.get('origin') !== new URL(request.url).origin) return adminFailure('forbidden');
      if (request.headers.get('content-type')?.split(';')[0]?.trim() !== 'application/json') return adminFailure('invalid_request');
      try {
        const reader = request.body?.getReader();
        if (!reader) throw Error();
        const chunks: Uint8Array[] = []; let size = 0;
        for (;;) {
          const chunk = await reader.read(); if (chunk.done) break;
          size += chunk.value.byteLength;
          if (size > 4096) { await reader.cancel(); throw Error(); }
          chunks.push(chunk.value);
        }
        const bytes = new Uint8Array(size); let at = 0;
        for (const chunk of chunks) { bytes.set(chunk, at); at += chunk.length; }
        const body = JSON.parse(new TextDecoder().decode(bytes));
        if (!body || typeof body !== 'object' || Array.isArray(body)
          || Object.keys(body).some(k => !['revision', 'radiusMeters', 'reason'].includes(k))
          || typeof body.revision !== 'string' || !/^[a-f0-9]{32}$/.test(body.revision)
          || !(body.radiusMeters === null || Number.isInteger(body.radiusMeters) && body.radiusMeters >= 25 && body.radiusMeters <= 300)
          || typeof body.reason !== 'string' || body.reason.trim().length < 10 || body.reason.length > 500) throw Error();
        Object.assign(args, { p_save: true, p_revision: body.revision, p_radius: body.radiusMeters, p_reason: body.reason.trim() });
      } catch { return adminFailure('invalid_request'); }
    }
    return json(decodeVerificationPolicy(await gateway.call('admin_shop_verification_policy', args)));
  } catch (error) {
    if (error instanceof AdminForbiddenError) return adminFailure('forbidden');
    if (error instanceof ShopOperationError) {
      const codes: Record<string, [number, string]> = { '40001': [409, 'revision_conflict'], P0002: [404, 'shop_not_found'], '22023': [422, 'invalid_request'] };
      const match = codes[error.code];
      if (match) return json({ ok: false, error: { code: match[1] } }, match[0]);
    }
    return adminFailure('service_unavailable');
  }
}
