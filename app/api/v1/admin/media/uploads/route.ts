import { mediaRoute } from '@/src/server/media/route';
export const dynamic = 'force-dynamic';
export const POST = (request: Request) => mediaRoute(request);
