import { deleteAccount } from "@/src/server/auth/http";
import { withAuthRoute } from "@/src/server/auth/route-context";

export async function DELETE(request: Request) {
  return withAuthRoute((dependencies) => deleteAccount(request, dependencies));
}
