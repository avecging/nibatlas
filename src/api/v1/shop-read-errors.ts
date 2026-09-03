export type ShopReadFailureKind = "network" | "http";

export class ShopReadHttpError extends Error {
  constructor(
    readonly kind: ShopReadFailureKind,
    readonly status: number | null,
    readonly code?: string,
    options?: ErrorOptions,
  ) {
    super(
      kind === "http"
        ? `Shop read request failed with HTTP ${status ?? "error"}`
        : "Shop read request failed before receiving a response",
      options,
    );
    this.name = "ShopReadHttpError";
  }
}

/** Cancellation is control flow, not a user-visible upstream failure. */
export class ShopReadAbortedError extends Error {
  constructor() {
    super("Shop read request aborted");
    this.name = "ShopReadAbortedError";
  }
}
