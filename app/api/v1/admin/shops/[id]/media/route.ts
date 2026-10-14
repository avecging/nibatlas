import { shopMediaRoute } from '@/src/server/media/shop-route';
export const dynamic = 'force-dynamic';
export async function GET(request: Request, context: {params: Promise<{id: string}>}) {
  const p = await context.params;
  return shopMediaRoute(request,p.id,null,false);
}
export const POST = GET;
