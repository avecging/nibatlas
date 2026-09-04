import { startMagicLink } from "@/src/server/auth/http";
import { withAuthRoute } from "@/src/server/auth/route-context";

export async function POST(request: Request) {
  return withAuthRoute((dependencies) => startMagicLink(request, dependencies));
}
