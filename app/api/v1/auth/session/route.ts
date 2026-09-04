import { readSession } from "@/src/server/auth/http";
import { withAuthRoute } from "@/src/server/auth/route-context";

export async function GET(request: Request) {
  return withAuthRoute((dependencies) => readSession(request, dependencies));
}
