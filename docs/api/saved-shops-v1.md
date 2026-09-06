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

`PUT` and `DELETE` require a same-origin `Origin` header. All success and error
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

## Errors

| Status | Code | Meaning |
| --- | --- | --- |
| `400` | `invalid_shop_id` | The path identifier is not a UUID. |
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
