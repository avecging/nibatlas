import { createSupabaseServerClient } from '@/src/server/supabase/server-client';
import { createAdminGateway } from '@/src/server/admin/route-context';
import { AdminForbiddenError, adminFailure } from '@/src/server/admin/http';
import { ShopOperationError } from '@/src/server/admin/shop-http';
import { handleVerificationPolicy } from '@/src/server/admin/verification-policy-http';

export const dynamic = 'force-dynamic';
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await createSupabaseServerClient();
    return await handleVerificationPolicy(request, (await context.params).id, {
      ...await createAdminGateway(session),
      async call(name, args) {
        const { data, error } = await session.rpc(name, args);
        if (error?.code === '42501') throw new AdminForbiddenError();
        if (error) throw new ShopOperationError(error.code);
        return data;
      },
    });
  } catch { return adminFailure('service_unavailable'); }
}
export const POST = GET;
