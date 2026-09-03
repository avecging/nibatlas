import { createServer } from "node:http";

const port = Number(process.env.API_E2E_UPSTREAM_PORT ?? 3100);
const sourceId = "00000000-0000-4000-8000-000000000501";

const shops = [
  {
    id: "00000000-0000-4000-8000-000000000301",
    slug: "m3-api-demo-shop",
    name: "M3 API Demo Shop",
    countryCode: "JP",
    localityName: "Tokyo",
    position: { latitude: 35.681236, longitude: 139.767125 },
    primaryType: "fountain_pen_specialist",
    specialtyLine: "A deterministic API integration fixture",
    operationalStatus: "open",
    markerState: "unvisited",
    sourceQuality: "demo",
    fixtureNotice: "Demo data",
  },
  {
    id: "00000000-0000-4000-8000-000000000302",
    slug: "m3-api-nearby-shop",
    name: "M3 API Nearby Shop",
    countryCode: "JP",
    localityName: "Tokyo",
    position: { latitude: 35.684, longitude: 139.77 },
    primaryType: "stationery_store",
    specialtyLine: null,
    operationalStatus: "open",
    markerState: "unvisited",
    sourceQuality: "demo",
    fixtureNotice: "Demo data",
  },
];

function detail(shop) {
  return {
    ...shop,
    timezone: "Asia/Tokyo",
    positionPrecision: "street",
    shopTypes: [shop.primaryType],
    specialties: [],
    services: [],
    brands: [],
    links: [],
    sources: [
      {
        id: sourceId,
        label: "Demo fixture",
        kind: "demo_fixture",
        retrievedOn: "2026-09-03",
        confirms: ["Name", `Shop type: ${shop.primaryType}`],
      },
    ],
  };
}

function send(response, status, body) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify(body));
}

async function bodyOf(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

let ginzaViewportAttempts = 0;

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", `http://127.0.0.1:${port}`);

  if (url.pathname === "/health") {
    send(response, 200, { ok: true });
    return;
  }

  if (url.pathname === "/control/reset" && request.method === "POST") {
    ginzaViewportAttempts = 0;
    send(response, 200, { ok: true });
    return;
  }

  const match = url.pathname.match(/^\/rest\/v1\/rpc\/(viewport_shops|search_shops|shop_detail|nearby_shops)$/);
  if (!match || request.method !== "POST") {
    send(response, 404, { message: "not found" });
    return;
  }

  let args;
  try {
    args = await bodyOf(request);
  } catch {
    send(response, 400, { message: "invalid json" });
    return;
  }

  switch (match[1]) {
    case "viewport_shops": {
      // The Ginza place fixture uses a close city viewport. Its first response
      // fails and its retry succeeds, giving Playwright a deterministic refresh
      // failure without a test-only branch in application code.
      const isGinza = Number(args.p_zoom) === 15 && Number(args.p_west) > 139;
      if (isGinza && ginzaViewportAttempts++ === 0) {
        send(response, 503, { message: "deterministic retry fixture" });
        return;
      }

      send(response, 200, {
        shops: [shops[0]],
        truncated: false,
        committedBounds: {
          west: args.p_west,
          south: args.p_south,
          east: args.p_east,
          north: args.p_north,
        },
        zoom: args.p_zoom,
      });
      return;
    }
    case "search_shops":
      send(response, 200, {
        query: args.p_query,
        shops: [
          {
            id: shops[0].id,
            slug: shops[0].slug,
            name: shops[0].name,
            countryCode: shops[0].countryCode,
            localityName: shops[0].localityName,
            matchedAlias: "M3 デモ店",
          },
        ],
      });
      return;
    case "shop_detail": {
      const shop = shops.find((candidate) => candidate.slug === args.p_slug);
      send(response, 200, shop ? detail(shop) : null);
      return;
    }
    case "nearby_shops":
      send(response, 200, {
        radiusMeters: args.p_radius_m,
        shops: shops.map((shop, index) => ({
          id: shop.id,
          slug: shop.slug,
          name: shop.name,
          countryCode: shop.countryCode,
          localityName: shop.localityName,
          position: shop.position,
          positionPrecision: "street",
          primaryType: shop.primaryType,
          operationalStatus: shop.operationalStatus,
          distanceMeters: index * 420,
        })),
      });
      return;
  }
});

server.listen(port, "127.0.0.1");

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
