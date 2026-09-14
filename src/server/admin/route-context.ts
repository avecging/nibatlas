import { createSupabaseServerClient } from '@/src/server/supabase/server-client';
import { AdminForbiddenError, adminFailure, handleAdminRead, type AdminGateway } from './http';

export async function createAdminGateway(
  client?: Awaited<ReturnType<typeof createSupabaseServerClient>>,
): Promise<AdminGateway> {
  // Ordinary cookie-bound client only; no service-role key for admin requests.
  const session = client ?? await createSupabaseServerClient();
  const rpc = async (name: string, args?: Record<string, unknown>) => {
    const { data, error } = await session.rpc(name, args);
    if (error?.code === '42501') throw new AdminForbiddenError();
    if (error) throw new Error('Admin service unavailable');
    return data;
  };
  return {
    async getIdentity() {
      const { data, error } = await session.auth.getClaims();
      if (error) return null;
      return typeof data?.claims.sub === 'string' ? data.claims.sub : null;
    },
    getAccess: () => rpc('admin_access'),
    listAudit: after => rpc('list_admin_audit', { p_after: after }),
  };
}
export async function adminReadRoute(request: Request, action: 'access' | 'audit') {
  try { return await handleAdminRead(request, action, await createAdminGateway()); }
  catch { return adminFailure('service_unavailable'); }
}
