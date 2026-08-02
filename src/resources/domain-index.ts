/**
 * domain-index (blueprint §8). Enumerates the 15-domain compliance taxonomy
 * from the laws DB (seeded in laws.sql) and reports corpus freshness from the
 * cached asset mtimes — the basis for list_domains and the §14 freshness eval.
 *
 * Phase 3: merges domain-module metadata (key instruments, sources, refresh
 * cadence) from src/domains/ into the DB rows, so list_domains is a single
 * rich surface for freshness + provenance checks.
 */
import type Database from "better-sqlite3";
import { cachedCorpusFreshness } from "../corpus-loader.js";
import type { CorpusPaths } from "../corpus-loader.js";
import { allDomainModules } from "../domains/index.js";

export interface DomainInfo {
  slug: string;
  name: string;
  description: string | null;
  lastRefresh: string | null;
  /** Key instruments from the domain module (may be empty if module missing). */
  keyInstruments: string[];
  /** Primary sources with refresh cadence. */
  sources: Array<{ name: string; url: string; cadence: string }>;
  refreshCadence: string | null;
}

export async function listDomains(
  lawsDb: Database.Database,
  paths: CorpusPaths,
): Promise<DomainInfo[]> {
  const rows = lawsDb
    .prepare("SELECT slug, name, description FROM domains ORDER BY slug")
    .all() as Array<{ slug: string; name: string; description: string | null }>;

  // Domains live in laws.sqlite, so per-domain freshness is the laws asset mtime.
  const lawsRefresh = await cachedCorpusFreshness(paths.laws);

  const bySlug = new Map(allDomainModules().map((d) => [d.module.slug, d]));

  return rows.map((r) => {
    const mod = bySlug.get(r.slug);
    return {
      slug: r.slug,
      name: r.name,
      description: r.description,
      lastRefresh: lawsRefresh,
      keyInstruments: mod?.module.keyInstruments ?? [],
      sources: mod?.module.sources.map((s) => ({ name: s.name, url: s.url, cadence: s.cadence })) ?? [],
      refreshCadence: mod?.module.refreshCadence ?? null,
    };
  });
}
