import { createClient } from '@supabase/supabase-js';
import { createSupabaseServerClient } from '@/src/server/supabase/server-client';
import { readSupabasePublicConfig } from '@/src/server/supabase/config';
import { handleStampRequest, stampFailure, type StampAction, type StampGateway } from '@/src/server/stamps/http';

export async function createStampGateway(): Promise<StampGateway> {
  const config = readSupabasePublicConfig();
  const secret = process.env['SUPABASE_SERVICE_ROLE_KEY']?.trim();
  if (!config || !secret) throw new Error('Verification unavailable');
  const session = await createSupabaseServerClient();
  const server = createClient(config.url, secret, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  return {
    async getIdentity() {
      const { data, error } = await session.auth.getClaims();
      if (error) throw new Error('Session unavailable');
      return typeof data?.claims.sub === 'string' ? data.claims.sub : null;
    },
    async rateLimit(userId) {
      const { data, error } = await server.rpc('stamp_verification_rate_limit', { p_user_id: userId });
      if (error || typeof data !== 'boolean') throw new Error('Verification unavailable');
      return data;
    },
    async action(input) {
      const { data, error } = await server.rpc('stamp_verification_action', {
        p_action: input.action, p_user_id: input.userId, p_shop_id: input.shopId,
        p_request_id: input.requestId, p_nonce_hash: input.nonceHash, p_payload: input.payload ?? {},
      });
      if (error) throw new Error('Verification unavailable');
      return data;
    },
  };
}
export async function stampRoute(request: Request, action: StampAction) {
  try { return await handleStampRequest(request, action, await createStampGateway()); }
  catch { return stampFailure('service_unavailable'); }
}
