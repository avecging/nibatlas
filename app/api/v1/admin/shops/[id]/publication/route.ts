import { publicationRoute } from '@/src/server/admin/publication-route';
export const dynamic = 'force-dynamic';
export async function GET(request: Request, context: {params: Promise<{id: string}>}) {
  return publicationRoute(request,(await context.params).id);
}
export const POST = GET;
