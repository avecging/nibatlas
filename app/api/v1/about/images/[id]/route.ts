import { aboutImageRoute } from "@/src/server/about/image-route";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return aboutImageRoute(request, (await params).id);
}
