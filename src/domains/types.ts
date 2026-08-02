/**
 * Domain module types (blueprint §4, §8). Each of the 15 compliance domains
 * (ADR-000 core 11 + ADR-004 expansion) is a module owning its ingestion
 * metadata, sources, refresh cadence, and cross-references. The registry in
 * `index.ts` aggregates them; `list_domains` merges module metadata with
 * corpus freshness.
 *
 * These are compile-time-safe plain data — no runtime dependency on the DB, so
 * the registry can also be used by the pipeline (Phase 3 ingest planning).
 */

/** A primary source for a domain, with its refresh cadence. */
export interface DomainSource {
  /** Human-readable source name, e.g. "Official Gazette". */
  name: string;
  /** Canonical URL (archive root, not a single page). */
  url: string;
  /** Refresh cadence for this source. */
  cadence: "weekly" | "monthly" | "quarterly" | "rarely";
}

export interface DomainModule {
  slug: string;
  name: string;
  description: string;
  /** Key statutes/instruments in the domain (short titles). */
  keyInstruments: string[];
  sources: DomainSource[];
  /** Which corpus files this domain writes into. */
  corpora: Array<"laws" | "cases" | "issuances">;
  /** Refresh cadence used by list_domains and the §14 freshness eval. */
  refreshCadence: "high" | "medium" | "low";
}

/** A cross-domain reference for the Phase 4 citations graph. */
export interface CrossReference {
  /** Target domain slug, e.g. "civil". */
  target: string;
  /** Why the target is relevant (for human + graph tool descriptions). */
  reason: string;
}

/** A domain module plus its cross-references. */
export interface DomainModuleWithRefs {
  module: DomainModule;
  crossRefs: CrossReference[];
}
