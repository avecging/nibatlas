import { describe, it, expect, vi } from "vitest";
import {
  handleAboutImage,
  AboutImageError,
  type AboutImageGateway,
} from "./images";
import { png } from "@/src/server/media/png.fixture";
import { validatePng } from "@/src/server/media/png";
const id = "11111111-1111-4111-8111-111111111111",
  bytes = png(2, 2),
  meta = validatePng(bytes, false);
function setup() {
  let ready = false;
  const operation = vi.fn(async (action: string) => {
    if (action === "finalize") ready = true;
    return { id, environment: "staging", ...meta, ready };
  });
  const gateway: AboutImageGateway = {
    authorize: vi.fn(async () => undefined),
    operation,
    environment: "staging",
    bucket: {
      put: vi.fn(async () => null),
      get: vi.fn(async () => ({
        size: bytes.length,
        httpMetadata: { contentType: "image/png" },
        body: new ReadableStream<Uint8Array>({
          start(c) {
            c.enqueue(new Uint8Array(bytes));
            c.close();
          },
        }),
      })),
    },
  };
  return gateway;
}
const upload = (data: Uint8Array = bytes, origin = "https://example.com") =>
  new Request("https://example.com/api/v1/admin/about/images", {
    method: "POST",
    headers: { Origin: origin, "Content-Type": "image/png" },
    body: new Uint8Array(data),
  });
describe("About private image transport", () => {
  it("authorizes before processing and refuses cross-origin uploads", async () => {
    const g = setup();
    g.authorize = vi.fn(async () => new Response(null, { status: 403 }));
    expect((await handleAboutImage(upload(), null, g)).status).toBe(403);
    expect(g.operation).not.toHaveBeenCalled();
    expect(g.bucket.put).not.toHaveBeenCalled();
    expect(
      (
        await handleAboutImage(
          upload(bytes, "https://evil.test"),
          null,
          setup(),
        )
      ).status,
    ).toBe(403);
  });
  it("validates bounded PNG before reserve, storage and trusted finalization", async () => {
    const g = setup();
    const r = await handleAboutImage(upload(), null, g);
    expect(r.status).toBe(201);
    expect(await r.json()).toEqual({ id, width: 2, height: 2 });
    expect(g.operation).toHaveBeenNthCalledWith(1, "reserve", null, {
      sha256: meta.sha256,
      byteSize: bytes.length,
      width: 2,
      height: 2,
    });
    expect(g.operation).toHaveBeenNthCalledWith(2, "finalize", id);
    expect(r.headers.get("cache-control")).toContain("no-store");
  });
  it("rejects metadata-bearing and malformed content without reserving", async () => {
    const g = setup();
    expect(
      (await handleAboutImage(upload(png(2, 2, { metadata: "eXIf" })), null, g))
        .status,
    ).toBe(422);
    expect(g.operation).not.toHaveBeenCalled();
  });
  it("does not finalize when storage fails", async () => {
    const g = setup();
    g.bucket.get = async () => null;
    expect((await handleAboutImage(upload(), null, g)).status).toBe(503);
    expect(g.operation).toHaveBeenCalledTimes(1);
  });
  it("public image delivery rechecks publication after reading storage", async () => {
    const g = setup();
    let calls = 0;
    g.operation = async () =>
      ++calls === 1
        ? { id, environment: "staging", ...meta, ready: true }
        : null;
    expect(
      (
        await handleAboutImage(
          new Request(`https://example.com/api/v1/about/images/${id}`),
          id,
          g,
        )
      ).status,
    ).toBe(404);
    expect(g.authorize).not.toHaveBeenCalled();
  });
  it("private reads refuse a role revoked during storage I/O", async () => {
    const g = setup();
    let calls = 0;
    g.operation = async () => {
      if (++calls > 1) throw new AboutImageError("42501");
      return { id, environment: "staging", ...meta, ready: true };
    };
    expect(
      (
        await handleAboutImage(
          new Request(`https://example.com/api/v1/admin/about/images/${id}`),
          id,
          g,
          true,
        )
      ).status,
    ).toBe(403);
  });
  it("rejects image metadata from another environment and never exposes keys", async () => {
    const g = setup();
    g.operation = async () => ({
      id,
      environment: "production",
      ...meta,
      ready: true,
    });
    const r = await handleAboutImage(
      new Request(`https://example.com/api/v1/about/images/${id}`),
      id,
      g,
    );
    expect(r.status).toBe(503);
    expect(await r.text()).not.toContain("production");
    expect(g.bucket.get).not.toHaveBeenCalled();
  });
});
