import { createSupabaseServerClient } from '@/src/server/supabase/server-client';
import { createAdminGateway } from '@/src/server/admin/route-context';
import { adminFailure, AdminForbiddenError } from '@/src/server/admin/http';
import { handleImport } from '@/src/server/admin/import-http';
export const dynamic = 'force-dynamic';
async function route(request: Request) {
  try {
    const session = await createSupabaseServerClient(), gateway = await createAdminGateway(session);
    return await handleImport(request, { ...gateway, async call(name, args) {
      const { data, error } = await session.rpc(name, args);
      if (error?.code === '42501') throw new AdminForbiddenError();
      if (error) throw Error('Import preview unavailable');
      return data;
    } });
  } catch { return adminFailure('service_unavailable'); }
}
export const GET = route;
export const POST = route;
