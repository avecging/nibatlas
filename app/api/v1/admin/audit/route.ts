import { adminReadRoute } from '@/src/server/admin/route-context';
export const dynamic = 'force-dynamic';
export const GET = (request: Request) => adminReadRoute(request, 'audit');
