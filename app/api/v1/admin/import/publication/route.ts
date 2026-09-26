import { createSupabaseServerClient } from '@/src/server/supabase/server-client';
import { createAdminGateway } from '@/src/server/admin/route-context';
import { adminFailure, AdminForbiddenError } from '@/src/server/admin/http';
import { ImportConflictError } from '@/src/server/admin/import-batch-http';
import { handleImportPublication } from '@/src/server/admin/import-publication-http';
export const dynamic = 'force-dynamic';
async function route(request: Request) {
  try {
    const session = await createSupabaseServerClient(), gateway = await createAdminGateway(session);
    return await handleImportPublication(request, { ...gateway, async call(name, args) {
      const { data, error } = await session.rpc(name, args);
      if (error?.code === '42501') throw new AdminForbiddenError();
      if (error?.code === '40001' || error?.code === '23505') throw new ImportConflictError();
      if (error) throw Error('Publication unavailable');
      return data;
    } });
  } catch { return adminFailure('service_unavailable'); }
}
export const GET = route;
export const POST = route;
