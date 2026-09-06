# Saved shops v1

Milestone 4 WP4 adds a private, session-backed application seam without changing
the cacheable public catalogue endpoints.

## Endpoints

- `GET /api/v1/saved-shops` lists the signed-in account's saved shop identifiers
  and compact catalogue-compatible details.
- `PUT /api/v1/saved-shops/{shopId}` saves a published shop and returns its
  reconciled saved representation.
- `DELETE /api/v1/saved-shops/{shopId}` removes a published shop from the signed-in
  account and returns the reconciled unsaved state.
- `POST /api/v1/saved-shops/import` reconciles up to 100 device-local identifiers
  at a time after sign-in. A candidate is `{"localId":"..."}`; a known prototype
  record may also carry its deterministic catalogue `slug` so the server can
  resolve the current canonical UUID. Unknown identifiers are never guessed.

`PUT`, `DELETE`, and `POST` require a same-origin `Origin` header. All success and error
responses use `Cache-Control: private, no-store` and `Pragma: no-cache`.

## Response shapes

The list response is:

```json
{
  "savedShopIds": ["00000000-0000-4000-8000-000000000301"],
  "shops": [
    {
      "id": "00000000-0000-4000-8000-000000000301",
      "slug": "m2-singapore-demo-fixture",
      "name": "M2 Singapore Demo Fixture",
      "countryCode": "SG",
      "localityName": "Singapore",
      "position": { "latitude": 1.29027, "longitude": 103.851959 },
      "primaryType": "fountain_pen_specialist",
      "specialtyLine": null,
      "operationalStatus": "unknown",
      "markerState": "saved",
      "sourceQuality": "demo",
      "fixtureNotice": "Demo data",
      "savedAt": "2026-09-04T16:30:00+00:00"
    }
  ]
}
```

Mutation responses contain `ok`, `shopId`, and `saved`. A successful save also
contains the compact `shop` representation above. Repeating either mutation is
successful and produces the same persisted state.

The import request body is capped at 32 KiB and has this shape:

```json
{
  "candidates": [
    { "localId": "shop-tw-juspirit-banqiao", "slug": "juspirit-banqiao" },
    { "localId": "00000000-0000-4000-8000-000000000301" }
  ]
}
```

Every accepted candidate appears exactly once in the response. `reconciled`
contains the account-backed saved shop; `skipped` contains `invalid-id` or
`unknown-shop` results; and `failed` contains transient `unavailable`
results. Clients may retire reconciled identifiers and `invalid-id` skips.
They must retain `unknown-shop` skips and failed identifiers on-device for
retry because a currently unpublished or renamed shop may become resolvable.

The browser records an attempt count and last-tried time for `unknown-shop`
identifiers. Automatic imports back off those identifiers for seven days, while
an explicit Retry bypasses the interval. A repeated batch that produces only
already-known `unknown-shop` results does not raise the import notice again.
There is no automatic terminal deletion: a record remains until it reconciles
or the reader explicitly clears local data on that device.

```json
{
  "ok": true,
  "reconciled": [{ "localId": "shop-tw-juspirit-banqiao", "shop": {} }],
  "skipped": [],
  "failed": [
    {
      "localId": "00000000-0000-4000-8000-000000000301",
      "reason": "unavailable"
    }
  ]
}
```

## Errors

| Status | Code | Meaning |
| --- | --- | --- |
| `400` | `invalid_shop_id` | The path identifier is not a UUID. |
| `400` | `invalid_import_request` | The import body, candidate shape, count, uniqueness, or byte size is invalid. |
| `401` | `authentication_required` | No valid owner session is available. |
| `403` | `untrusted_origin` | A mutation did not originate from this application. |
| `404` | `shop_not_found` | The identifier does not name a published shop. |
| `502` | `saved_shop_upstream_failed` | The authenticated data operation failed. |
| `502` | `invalid_upstream_contract` | The database returned an invalid response shape. |
| `503` | `session_unavailable` | Session validation could not be completed. |
| `503` | `saved_shop_service_unavailable` | Supabase is not configured for the application. |

The client cannot submit an account identifier. The server derives it from the
authenticated session, and each database mutation derives it again from
`auth.uid()`. Public catalogue responses remain user-independent and cacheable.
