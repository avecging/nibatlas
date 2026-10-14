import { updateDisplayName } from "@/src/server/auth/http";
import { withAuthRoute } from "@/src/server/auth/route-context";

export async function PATCH(request: Request) {
  return withAuthRoute((dependencies) => updateDisplayName(request, dependencies));
}
