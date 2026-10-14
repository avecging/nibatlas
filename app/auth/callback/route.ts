import { finishOAuthCallback } from "@/src/server/auth/http";
import { withAuthRoute } from "@/src/server/auth/route-context";

export async function GET(request: Request) {
  return withAuthRoute((dependencies) =>
    finishOAuthCallback(request, dependencies),
  );
}
