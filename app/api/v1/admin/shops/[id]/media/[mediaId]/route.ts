import { shopMediaRoute } from '@/src/server/media/shop-route';
export const dynamic = 'force-dynamic';
export async function GET(request: Request, context: {params: Promise<{id: string; mediaId: string}>}) {
  const p = await context.params;
  return shopMediaRoute(request,p.id,p.mediaId,false);
}
