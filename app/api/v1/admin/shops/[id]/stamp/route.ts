import { stampAdminRoute } from '@/src/server/media/stamp-admin-route';
export const dynamic='force-dynamic';
export async function GET(request:Request,context:{params:Promise<{id:string}>}) {
  const p=await context.params; return stampAdminRoute(request,p.id);
}
export const POST=GET;
