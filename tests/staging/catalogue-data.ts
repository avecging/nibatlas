import { expect, type APIRequestContext } from "@playwright/test";
import { decodeViewportShopsV1 } from "@/src/api/v1/shop-read";

/** Read existing staging data; smoke tests never create catalogue records. */
export async function stagingCatalogue(request: APIRequestContext) {
  const response = await request.get(
    "/api/v1/shops/viewport?west=-180&south=-85&east=180&north=85&zoom=2&limit=500",
  );
  expect(response.ok(), "Staging catalogue API must succeed, even when empty").toBe(true);
  return decodeViewportShopsV1(await response.json());
}
