import { mediaRoute } from '@/src/server/media/route';
export const dynamic = 'force-dynamic';
type Context = { params: Promise<{ id: string }> };
async function route(request: Request, context: Context) {
  return mediaRoute(request, (await context.params).id);
}
export { route as GET, route as PUT, route as POST };
