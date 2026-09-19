import { stampArtworkRoute } from '@/src/server/media/stamp-artwork-route';
export const dynamic='force-dynamic';
export async function GET(request:Request,context:{params:Promise<{stampId:string;version:string}>}) {
  const p=await context.params;
  return stampArtworkRoute(request,p.stampId,p.version);
}
