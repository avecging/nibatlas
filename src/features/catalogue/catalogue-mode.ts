/**
 * Which catalogue the interface reads.
 *
 * Milestone 3 gives the frontend two suppliers behind one domain contract: the
 * deterministic prototype fixtures, and the merged Milestone 2 read API at
 * `/api/v1/shops/*`. Issue #25 requires the choice to be **explicit**, and
 * requires that a broken API configuration never quietly become fixture data —
 * fixtures rendered during an outage would look like a working catalogue that
 * had simply lost some shops.
 *
 * So there are three outcomes, not two:
 *
 * - `fixture` — the documented default. Nothing was asked of the API, so
 *   nothing about it is being hidden. Tests, reviewer mode, and local frontend
 *   work all run here.
 * - `api` — asked for explicitly. Every failure surfaces as a failure.
 * - `misconfigured` — a value that is neither. Surfaces say the catalogue is
 *   unavailable rather than falling back to fixtures and disguising it.
 */
export type CatalogueMode = "fixture" | "api" | "misconfigured";

/** The literal `process.env` key. Never composed, so Next can inline it. */
export const CATALOGUE_MODE_ENV_VAR = "NEXT_PUBLIC_CATALOGUE_MODE";

export interface CatalogueModeResolution {
  readonly mode: CatalogueMode;
  /** Whether a deployment asked for this mode by name. */
  readonly explicit: boolean;
  /**
   * Whether demo-quality staging records are acceptable.
   *
   * `demo_fixture` is a wire source kind for staging and test records only
   * (`docs/api/v1-shop-reads.md`). It is never cast into one of the four real
   * provenance kinds, and outside a demo-accepting mode a record carrying it
   * fails closed instead of being presented as a real business.
   */
  readonly demoRecords: boolean;
  /** The rejected value, on `misconfigured` only. */
  readonly value?: string;
}

/**
 * Resolves a configured value.
 *
 * Trimmed and lower-cased, because a deployment variable typed with a trailing
 * space is a typo rather than a decision. Absent or empty is the fixture
 * default; anything unrecognised is a misconfiguration.
 *
 * `api-demo` is API mode that additionally accepts the demo-quality staging
 * projection, which is what the Milestone 3 staging smoke reads. Plain `api`
 * rejects it.
 */
export function resolveCatalogueMode(
  raw: string | null | undefined,
): CatalogueModeResolution {
  const value = (raw ?? "").trim();

  if (value === "") {
    return { mode: "fixture", explicit: false, demoRecords: true };
  }

  switch (value.toLowerCase()) {
    case "fixture":
    case "fixtures":
      return { mode: "fixture", explicit: true, demoRecords: true };
    case "api":
      return { mode: "api", explicit: true, demoRecords: false };
    case "api-demo":
      return { mode: "api", explicit: true, demoRecords: true };
    default:
      return { mode: "misconfigured", explicit: true, demoRecords: false, value };
  }
}

/**
 * Reads the environment.
 *
 * The expression is the literal `process.env.NEXT_PUBLIC_CATALOGUE_MODE`
 * because Next inlines a `NEXT_PUBLIC_` value into the browser bundle by
 * matching that text; bracket notation or a composed key would leave
 * `undefined` on the client.
 */
export function readCatalogueMode(): CatalogueModeResolution {
  return resolveCatalogueMode(process.env.NEXT_PUBLIC_CATALOGUE_MODE);
}

/** One line for reviewer mode, so a tester can see which supplier is live. */
export function catalogueModeDiagnostic(resolution: CatalogueModeResolution): string {
  if (resolution.mode === "misconfigured") {
    return `Catalogue: misconfigured (${CATALOGUE_MODE_ENV_VAR}="${resolution.value ?? ""}")`;
  }

  if (resolution.mode === "api") {
    return `Catalogue: v1 read API${resolution.demoRecords ? " (demo records accepted)" : ""}`;
  }

  return `Catalogue: prototype fixtures${resolution.explicit ? "" : " (default)"}`;
}
