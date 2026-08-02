/**
 * Catalog-driven adapter targets (production-readiness push, 0.7.0).
 *
 * Source adapters are driven by the instrument catalog: every catalogued
 * instrument whose sourceUrl lives under an adapter's baseUrl is a fetch
 * target. This keeps ingestion declarative (nothing is fetched that isn't
 * catalogued) and makes adapters trivially testable without network access.
 */
import type { CatalogEntry } from "../catalog.js";
import { INSTRUMENT_CATALOG } from "../catalog.js";
import type { StatuteRecord } from "../types.js";

/** All catalogued instruments whose sourceUrl is under `baseUrl`. */
export function catalogTargetsFor(baseUrl: string): CatalogEntry[] {
  return INSTRUMENT_CATALOG.filter((e) => e.sourceUrl.startsWith(baseUrl));
}

/**
 * Map a catalog kind to the statutes-table kind. The catalog distinguishes
 * `act` (e.g. Act No. 3815, the Revised Penal Code) and `rules` (e.g. the
 * Rules of Court); the DB CHECK constraint now accepts those values too, so
 * this is an identity — kept as an explicit seam for when kinds diverge.
 */
export function mapCatalogKind(kind: CatalogEntry["kind"]): StatuteRecord["kind"] {
  return kind;
}
