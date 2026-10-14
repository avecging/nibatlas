import { reviewRoute } from '@/src/server/admin/review-route';
export const dynamic = 'force-dynamic';
export async function GET(request: Request, context: {params: Promise<{id: string}>}) {
  return reviewRoute(request,(await context.params).id);
}
export const POST = GET;
