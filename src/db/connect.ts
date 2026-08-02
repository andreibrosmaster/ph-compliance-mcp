/**
 * connect — opens the three corpus files and ATTACHes them to a primary
 * connection so cross-corpus queries work (ADR-003; Phase 4 adds a 4th
 * embeddings.sqlite here via the same mechanism).
 *
 * The primary (laws) connection is opened read/write because SQLite forbids
 * ATTACH on connections whose main database was opened with SQLITE_OPEN_READONLY;
 * `query_only = ON` makes every SQL write fail, so the corpus stays immutable
 * in practice. cases/issuances are opened read-only as separate handles.
 *
 * Missing corpus files are self-initialized with their schema so the server
 * starts even when a local override provides only some files — per ADR-003 the
 * issuances corpus legitimately stays empty until Phase 3.
 */
import { existsSync } from "node:fs";
import { readFileSync } from "node:fs";
import Database from "better-sqlite3";
import type { CorpusPaths } from "../corpus-loader.js";

export interface CorpusConnection {
  /** Primary DB (laws) — serves most statutory queries. */
  db: Database.Database;
  /** All open handles, keyed by corpus name. Cases/issuances queries MUST use these. */
  handles: Record<"laws" | "cases" | "issuances", Database.Database>;
  close: () => void;
}

function schemaSql(corpus: "laws" | "cases" | "issuances"): string {
  return readFileSync(new URL(`./schema/${corpus}.sql`, import.meta.url), "utf8");
}

function ensureCorpusFile(path: string, corpus: "laws" | "cases" | "issuances"): void {
  if (existsSync(path)) return;
  const db = new Database(path);
  db.exec(schemaSql(corpus));
  db.close();
}

export function connectCorpus(paths: CorpusPaths): CorpusConnection {
  // Self-initialize missing corpus files (empty corpora are legitimate pre-Phase 3).
  ensureCorpusFile(paths.laws, "laws");
  ensureCorpusFile(paths.cases, "cases");
  ensureCorpusFile(paths.issuances, "issuances");

  const laws = new Database(paths.laws); // writable so ATTACH works
  const cases = new Database(paths.cases, { readonly: true });
  const issuances = new Database(paths.issuances, { readonly: true });

  laws.pragma("query_only = ON");
  cases.pragma("query_only = ON");
  issuances.pragma("query_only = ON");

  // ATTACH provides cross-DB query capability for later phases.
  try {
    laws.exec(`ATTACH DATABASE '${paths.cases.replace(/'/g, "''")}' AS cases_db`);
  } catch {
    // cases.sqlite may legitimately be empty/minimal pre-Phase 3; still usable.
  }
  try {
    laws.exec(`ATTACH DATABASE '${paths.issuances.replace(/'/g, "''")}' AS issuances_db`);
  } catch {
    // issuances.sqlite stays empty until Phase 3 (ADR-003).
  }

  return {
    db: laws,
    handles: { laws, cases, issuances },
    close: () => {
      cases.close();
      issuances.close();
      laws.close();
    },
  };
}
