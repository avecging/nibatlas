import { stampRoute } from '@/src/server/stamps/route-context';
export async function POST(request: Request): Promise<Response> {
  return stampRoute(request, 'collect');
}
