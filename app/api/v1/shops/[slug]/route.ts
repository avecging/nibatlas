import { getShopDetail } from "@/src/server/http/shop-read-routes";

export async function GET(
  request: Request,
  context: { params: Promise<{ slug: string }> },
): Promise<Response> {
  const { slug } = await context.params;
  return getShopDetail(request, slug);
}

