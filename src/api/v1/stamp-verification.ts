/** Public v1 contract. Diagnostic measurements and policy thresholds stay private. */
export const STAMP_FAILURE_STATUS = {
  authentication_required: 401,
  permission_denied: 403,
  untrusted_origin: 403,
  poor_accuracy: 422,
  stale_position: 422,
  outside_radius: 422,
  invalid_nonce: 409,
  expired_nonce: 409,
  reused_nonce: 409,
  throttled: 429,
  shop_unavailable: 404,
  service_unavailable: 503,
  invalid_request: 400,
} as const;
export type StampFailureCode = keyof typeof STAMP_FAILURE_STATUS;
export interface CollectionV1 {
  readonly id: string;
  readonly shopId: string;
  readonly stampId: string;
  readonly collectedAt: string;
  readonly shopTimezone: string;
  readonly shopName: string;
  readonly place: Readonly<Record<string, unknown>>;
  readonly stamp: Readonly<Record<string, unknown>>;
}
export type StampResponseV1 =
  | { readonly ok: false; readonly error: { readonly code: StampFailureCode } }
  | { readonly ok: true; readonly status: 'nonce_issued'; readonly requestId: string; readonly nonce: string }
  | { readonly ok: true; readonly status: 'confirmation_required' }
  | { readonly ok: true; readonly status: 'success' | 'duplicate'; readonly collection: CollectionV1;
      readonly invalidate: readonly ['collections', 'visited-shops', 'passport'] };
export interface VerificationBindingV1 {
  readonly shopId: string;
  readonly requestId: string;
  readonly nonce: string;
}
export type VerifyRequestV1 = VerificationBindingV1 & (
  | { readonly permission: 'denied' }
  | { readonly position: { readonly latitude: number; readonly longitude: number; readonly accuracy: number } }
);
export type CollectRequestV1 = VerificationBindingV1 & { readonly confirmedAtShop: true };
