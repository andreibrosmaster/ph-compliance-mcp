/**
 * Graph population pass (Phase 4). Walks every case and statute in the built
 * corpora, extracts citation spans from their texts, and records only RESOLVED
 * edges into citations_graph. Runs in the pipeline (CI-only), never at server
 * runtime. Idempotent: the resolver uses INSERT OR IGNORE + a unique index.
 */
import type Database from "better-sqlite3";
import { extractCitations } from "./extractor.js";
import { buildGraphForSource } from "./resolver.js";

export interface GraphPopulationStats {
  cases: number;
  /** Rows actually written for statute->* edges. */
  statuteEdges: number;
  /** Total rows actually written to citations_graph (0 on an idempotent re-run). */
  edgesInserted: number;
  spans: number;
  resolved: number;
  unresolved: number;
}

export function populateCitationGraph(
  casesDb: Database.Database,
  lawsDb: Database.Database,
): GraphPopulationStats {
  let spans = 0;
  let resolved = 0;
  let unresolved = 0;
  let edgesInserted = 0;

  // Case → statute/case edges.
  const caseRows = casesDb.prepare("SELECT id FROM cases").all() as Array<{ id: number }>;
  for (const c of caseRows) {
    const passages = casesDb
      .prepare("SELECT body FROM case_passages WHERE case_id = ?")
      .all(c.id) as Array<{ body: string }>;
    const text = passages.map((p) => p.body).join("\n");
    const spanList = extractCitations(text);
    const stats = buildGraphForSource(casesDb, lawsDb, { kind: "case", id: c.id }, spanList);
    spans += stats.spans;
    resolved += stats.resolved;
    unresolved += stats.unresolved;
    edgesInserted += stats.edgesInserted;
  }

  // Statute → statute dependency edges (law cites law, e.g. "as amended by RA 10951").
  const statuteRows = lawsDb.prepare("SELECT id FROM statutes").all() as Array<{ id: number }>;
  let statuteEdges = 0;
  for (const s of statuteRows) {
    const provisions = lawsDb
      .prepare("SELECT body FROM provisions WHERE statute_id = ?")
      .all(s.id) as Array<{ body: string }>;
    const text = provisions.map((p) => p.body).join("\n");
    const spanList = extractCitations(text);
    const stats = buildGraphForSource(casesDb, lawsDb, { kind: "statute", id: s.id }, spanList);
    spans += stats.spans;
    resolved += stats.resolved;
    unresolved += stats.unresolved;
    statuteEdges += stats.edgesInserted;
    edgesInserted += stats.edgesInserted;
  }

  return { cases: caseRows.length, statuteEdges, edgesInserted, spans, resolved, unresolved };
}
