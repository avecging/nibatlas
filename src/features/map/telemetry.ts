/**
 * Product event taxonomy from `ARCHITECTURE.md`.
 *
 * The payload type deliberately cannot carry coordinates, raw search text, or
 * tokens. Milestone 1 records events to a no-op sink; the Cloudflare Analytics
 * Engine adapter arrives with the integration milestone.
 */
export type MapTelemetryEvent =
  | "map_view_committed"
  | "destination_searched"
  | "shop_opened"
  | "shop_saved"
  | "directions_opened"
  | "stamp_verification_result"
  | "stamp_collected"
  | "passport_opened";

export interface MapTelemetryPayload {
  readonly zoom?: number;
  readonly resultCount?: number;
  readonly truncated?: boolean;
  readonly countryCode?: string;
  readonly shopSlug?: string;
  readonly outcome?: string;
  readonly surface?: string;
  readonly queryLength?: number;
}

export interface MapTelemetry {
  record(event: MapTelemetryEvent, payload?: MapTelemetryPayload): void;
}

export const noopTelemetry: MapTelemetry = {
  record() {
    // Intentionally empty until the analytics adapter lands.
  },
};

export function createDebugTelemetry(
  sink: (line: string) => void = () => {},
): MapTelemetry {
  return {
    record(event, payload) {
      sink(`${event} ${JSON.stringify(payload ?? {})}`);
    },
  };
}
