import {
  InvalidMedia,
  MAX_MEDIA_BYTES,
  readBounded,
  validatePng,
} from "@/src/server/media/png";
import { processJpeg, type PhotoImages } from "@/src/server/media/jpeg";
import type { MediaBucket } from "@/src/server/media/r2";
import { UUID } from "@/src/features/admin/shop-contract";
const HEADERS = {
  "Cache-Control": "private, no-store",
  Pragma: "no-cache",
  Vary: "Cookie",
  "X-Content-Type-Options": "nosniff",
  "X-Robots-Tag": "noindex",
  "Content-Security-Policy": "default-src 'none'; sandbox",
};
export class AboutImageError extends Error {
  constructor(readonly code: string) {
    super("Image unavailable");
  }
}
export interface AboutImageGateway {
  authorize(): Promise<Response | void>;
  operation(
    action: "reserve" | "finalize" | "read",
    id: string | null,
    payload?: Record<string, unknown>,
  ): Promise<unknown>;
  bucket: MediaBucket;
  environment: string;
  images?: PhotoImages | undefined;
}
function asset(value: unknown, environment: string) {
  if (!value || typeof value !== "object") throw new AboutImageError("P0002");
  const a = value as Record<string, unknown>;
  if (
    typeof a.id !== "string" ||
    !UUID.test(a.id) ||
    !["staging", "production"].includes(environment) ||
    a.environment !== environment ||
    typeof a.sha256 !== "string" ||
    !/^[a-f0-9]{64}$/.test(a.sha256) ||
    !Number.isInteger(a.byteSize) ||
    (a.byteSize as number) < 1 ||
    (a.byteSize as number) > MAX_MEDIA_BYTES ||
    [a.width, a.height].some(
      (v) => !Number.isInteger(v) || (v as number) < 1 || (v as number) > 2048,
    ) ||
    typeof a.ready !== "boolean"
  )
    throw Error("Invalid image");
  return {
    id: a.id,
    key: `${environment}/about/${a.id}/${a.sha256}.png`,
    sha256: a.sha256,
    byteSize: a.byteSize as number,
    width: a.width as number,
    height: a.height as number,
    ready: a.ready,
  };
}
export async function handleAboutImage(
  request: Request,
  id: string | null,
  gateway: AboutImageGateway,
  privateRead = false,
) {
  const fail = (error: string, status: number) =>
    Response.json({ error: { code: error } }, { status, headers: HEADERS });
  try {
    if (
      new URL(request.url).search ||
      (id !== null && !UUID.test(id)) ||
      request.method !== (id === null ? "POST" : "GET")
    )
      return fail("invalid_request", 400);
    if (
      id === null &&
      request.headers.get("origin") !== new URL(request.url).origin
    )
      return fail("forbidden", 403);
    if (id === null || privateRead) {
      const denied = await gateway.authorize();
      if (denied) return denied;
    }
    if (id === null) {
      const type = request.headers.get("content-type");
      if (type !== "image/png" && type !== "image/jpeg")
        return fail("invalid_upload", 422);
      const input = await readBounded(request.body, MAX_MEDIA_BYTES);
      let bytes: Uint8Array, checked: ReturnType<typeof validatePng>;
      if (type === "image/jpeg") {
        if (!gateway.images) throw Error("Image processing unavailable");
        const processed = await processJpeg(input, gateway.images);
        bytes = processed.bytes;
        checked = processed.checked;
      } else {
        bytes = input;
        checked = validatePng(bytes, false);
      }
      // reserve/finalize both recheck and lock the actor's current admin role.
      const a = asset(
        await gateway.operation("reserve", null, {
          sha256: checked.sha256,
          byteSize: bytes.length,
          width: checked.width,
          height: checked.height,
        }),
        gateway.environment,
      );
      if (
        a.sha256 !== checked.sha256 ||
        a.byteSize !== bytes.length ||
        a.width !== checked.width ||
        a.height !== checked.height ||
        a.ready
      )
        throw Error("Invalid reservation");
      await gateway.bucket.put(a.key, bytes, {
        onlyIf: new Headers({ "If-None-Match": "*" }),
        httpMetadata: {
          contentType: "image/png",
          cacheControl: "private, no-store",
        },
      });
      const stored = await gateway.bucket.get(a.key);
      if (
        !stored ||
        stored.size !== a.byteSize ||
        stored.httpMetadata?.contentType !== "image/png"
      )
        throw Error("Image not stored");
      await stored.body.cancel();
      const done = asset(
        await gateway.operation("finalize", a.id),
        gateway.environment,
      );
      if (!done.ready || done.key !== a.key || done.byteSize !== a.byteSize)
        throw Error("Image not finalized");
      return Response.json(
        { id: a.id, width: a.width, height: a.height },
        { status: 201, headers: HEADERS },
      );
    }
    const resolve = async () => {
      const a = asset(await gateway.operation("read", id), gateway.environment);
      if (!a.ready || a.id !== id) throw new AboutImageError("P0002");
      return a;
    };
    const a = await resolve(),
      stored = await gateway.bucket.get(a.key);
    if (
      !stored ||
      stored.size !== a.byteSize ||
      stored.httpMetadata?.contentType !== "image/png"
    )
      throw Error("Missing image");
    // Recheck publication/current role after storage I/O. Draft removal never hides the old publication.
    if ((await resolve()).key !== a.key) throw Error("Image changed");
    return new Response(stored.body, {
      headers: {
        ...HEADERS,
        "Content-Type": "image/png",
        "Content-Length": String(a.byteSize),
      },
    });
  } catch (e) {
    const code = e instanceof AboutImageError ? e.code : "";
    return fail(
      "image_unavailable",
      e instanceof InvalidMedia || ["22023", "23514", "22P02"].includes(code)
        ? 422
        : code === "42501"
          ? 403
          : code === "P0002"
            ? 404
            : code === "54000"
              ? 429
              : 503,
    );
  }
}
