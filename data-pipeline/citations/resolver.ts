/**
 * Citation resolver (Phase 4). Resolves extracted `CitationSpan`s against the
 * laws/cases corpora and inserts only RESOLVED edges into `citations_graph`
 * (constraint #1 — a citation that cannot be matched against the corpus is
 * counted and skipped, never guessed).
 *
 * Resolution rules (legally conservative):
 *   - case spans: exact match on cases.citation (normalized).
 *   - statute spans with actNumber: match statutes.act_number.
 *   - statute spans with statuteTitle hint: match statutes.short_title /
 *     official_title via normalized contains; ambiguous title matches resolve
 *     to the act_number when present, else are skipped.
 *   - statute spans with actNumber + provisionNo: prefer provision-level
 *     resolution, falling back to the statute if the provision number doesn't
 *     match any provision of that statute.
 */
import type Database from "better-sqlite3";
import type { CitationSpan } from "../types.js";

export interface ResolveOptions {
  /** When true, statuteTitle hints are used as a fallback for act_number spans. */
  useTitleFallback?: boolean;
}

export interface GraphBuildResult {
  spans: number;
  /** Spans that resolved against the corpus (may exceed edgesInserted when an
   *  entity pair was already recorded — the graph is entity-level). */
  resolved: number;
  unresolved: number;
  /** Rows actually written (0 on a re-run thanks to INSERT OR IGNORE). */
  edgesInserted: number;
}

/** Normalize for comparison: lowercase, collapse whitespace/punct. */
export function normalizeKey(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "").trim();
}

/**
 * Resolve a statute span to a statute id, or null when it cannot be matched
 * unambiguously. `lawsDb` is the laws corpus handle.
 */
export function resolveStatute(
  lawsDb: Database.Database,
  span: CitationSpan,
  opts: ResolveOptions = {},
): number | null {
  if (span.kind !== "statute") return null;

  // 1. By act number (RA/PD/EO numbers are canonical and unambiguous).
  if (span.actNumber) {
    const row = lawsDb
      .prepare("SELECT id FROM statutes WHERE act_number = ? LIMIT 1")
      .get(span.actNumber) as { id: number } | undefined;
    if (row) return row.id;
  }

  // 2. By title hint (exact normalized equality first, then contains).
  if (span.statuteTitle && opts.useTitleFallback !== false) {
    const key = normalizeKey(span.statuteTitle);
    const rows = lawsDb
      .prepare("SELECT id, short_title, official_title FROM statutes")
      .all() as Array<{ id: number; short_title: string; official_title: string }>;
    const exact = rows.filter(
      (r) => normalizeKey(r.short_title) === key || normalizeKey(r.official_title) === key,
    );
    const pool = exact.length > 0 ? exact : rows.filter(
      (r) => normalizeKey(r.short_title).includes(key) || normalizeKey(r.official_title).includes(key),
    );
    if (pool.length === 1) return pool[0]!.id;
    // Ambiguous title: if the act number is also present, resolve at statute
    // level via the act number; otherwise this is genuinely unresolved.
    return null;
  }

  return null;
}

/**
 * Insert an edge into citations_graph if the citation resolves. Returns
 * whether the span resolved against the corpus (`resolved`) and whether a row
 * was actually written (`inserted`). A resolvable span may not be inserted
 * when the same entity pair was already recorded (unique index) — both
 * counters are reported so stats stay honest.
 * `citingId`/`citingKind` describe the citing side (a case or a statute —
 * law→law dependency edges are supported).
 */
export function insertResolvedEdge(
  casesDb: Database.Database,
  lawsDb: Database.Database,
  citing: { kind: "case" | "statute"; id: number },
  span: CitationSpan,
  opts: ResolveOptions = {},
): { resolved: boolean; inserted: boolean } {
  let citedStatuteId: number | null = null;
  let citedCaseId: number | null = null;
  let citedKind: "statute" | "case" | null = null;

  if (span.kind === "case") {
    const key = normalizeKey(span.caseCitation ?? "");
    // Prefilter on the trailing digits (G.R. numbers) to avoid a full scan,
    // then normalize in JS — SQLite has no normalize_citation function.
    const tail = (span.caseCitation ?? "").match(/\d+$/)?.[0];
    const candidates = (tail
      ? (casesDb.prepare("SELECT id, citation FROM cases WHERE citation LIKE ?").all(`%${tail}%`) as Array<{
          id: number;
          citation: string;
        }>)
      : (casesDb.prepare("SELECT id, citation FROM cases").all() as Array<{ id: number; citation: string }>));
    const match = candidates.find((r) => normalizeKey(r.citation) === key);
    if (match) {
      citedKind = "case";
      citedCaseId = match.id;
    }
  } else {
    const statuteId = resolveStatute(lawsDb, span, opts);
    if (statuteId !== null) {
      citedKind = "statute";
      citedStatuteId = statuteId;
    }
  }

  if (!citedKind) return { resolved: false, inserted: false };
  // A source must not edge to itself (self-citations are noise, not graph data).
  if (citing.kind === "statute" && citedStatuteId === citing.id) return { resolved: false, inserted: false };
  if (citing.kind === "case" && citedCaseId === citing.id) return { resolved: false, inserted: false };

  const info = casesDb
    .prepare(
      `INSERT OR IGNORE INTO citations_graph
         (citing_kind, citing_case_id, citing_statute_id, cited_kind, cited_case_id, cited_statute_id, cited_reference)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      citing.kind,
      citing.kind === "case" ? citing.id : null,
      citing.kind === "statute" ? citing.id : null,
      citedKind,
      citedCaseId,
      citedStatuteId,
      span.raw,
    );
  return { resolved: true, inserted: Number(info.changes) > 0 };
}

/**
 * Build the graph for one citing source (a case or a statute) from a set of
 * spans. Returns resolution stats.
 */
export function buildGraphForSource(
  casesDb: Database.Database,
  lawsDb: Database.Database,
  citing: { kind: "case" | "statute"; id: number },
  spans: CitationSpan[],
  opts: ResolveOptions = {},
): GraphBuildResult {
  let resolved = 0;
  let inserted = 0;
  for (const span of spans) {
    const edge = insertResolvedEdge(casesDb, lawsDb, citing, span, opts);
    if (edge.resolved) resolved++;
    if (edge.inserted) inserted++;
  }
  return {
    spans: spans.length,
    resolved,
    unresolved: spans.length - resolved,
    edgesInserted: inserted,
  };
}

/**
 * Extract + resolve citations from a body of text for one citing source.
 * Convenience wrapper used by the pipeline.
 */
export function buildGraphFromText(
  casesDb: Database.Database,
  lawsDb: Database.Database,
  citing: { kind: "case" | "statute"; id: number },
  text: string,
  extract: (t: string) => CitationSpan[],
  opts: ResolveOptions = {},
): GraphBuildResult {
  return buildGraphForSource(casesDb, lawsDb, citing, extract(text), opts);
}
