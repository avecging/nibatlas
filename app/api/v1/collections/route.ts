import { listCollections } from '@/src/server/stamps/collections';
import { stampFailure } from '@/src/server/stamps/http';
import { createSupabaseServerClient } from '@/src/server/supabase/server-client';

export async function GET(request: Request): Promise<Response> {
  try {
    const client = await createSupabaseServerClient();
    return await listCollections(request, {
      getIdentity: async () => {
        const { data, error } = await client.auth.getClaims();
        return !error && typeof data?.claims.sub === 'string' ? data.claims.sub : null;
      },
      list: async (after) => {
        const { data, error } = await client.rpc('list_stamp_collections', { p_after: after });
        if (error) throw new Error('Collection read unavailable');
        return data;
      },
    });
  } catch { return stampFailure('service_unavailable'); }
}
