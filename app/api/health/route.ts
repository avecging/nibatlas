export function GET() {
  return Response.json({
    service: "nibatlas",
    status: "ok",
    version: "0.1.0",
  });
}
