/**
 * Graph query helpers (Phase 4). Shared SQL lookups behind the 8 graph tools.
 * All reads: citations_graph lives in cases.sqlite; statutes/provisions/
 * amendments live in laws.sqlite. Nothing here writes.
 */
import type Database from "better-sqlite3";

export interface GraphContext {
  laws: Database.Database;
  cases: Database.Database;
}

/** Normalize for comparison (mirrors the pipeline resolver). */
export function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

export function resolveCaseId(ctx: GraphContext, citation: string): number | null {
  const key = norm(citation);
  const tail = citation.match(/\d+$/)?.[0];
  const candidates = tail
    ? (ctx.cases.prepare("SELECT id, citation FROM cases WHERE citation LIKE ?").all(`%${tail}%`) as Array<{
        id: number;
        citation: string;
      }>)
    : (ctx.cases.prepare("SELECT id, citation FROM cases").all() as Array<{ id: number; citation: string }>);
  const hit = candidates.find((r) => norm(r.citation) === key);
  return hit ? hit.id : null;
}

export function resolveStatuteId(
  ctx: GraphContext,
  statute: string,
  actNumber?: string,
): number | null {
  if (actNumber) {
    const row = ctx.laws
      .prepare("SELECT id FROM statutes WHERE act_number = ? LIMIT 1")
      .get(actNumber) as { id: number } | undefined;
    if (row) return row.id;
  }
  const key = norm(statute);
  const rows = ctx.laws
    .prepare("SELECT id, short_title, official_title FROM statutes")
    .all() as Array<{ id: number; short_title: string; official_title: string }>;
  const exact = rows.filter(
    (r) => norm(r.short_title) === key || norm(r.official_title) === key,
  );
  const pool = exact.length > 0 ? exact : rows.filter(
    (r) => norm(r.short_title).includes(key) || norm(r.official_title).includes(key),
  );
  return pool.length === 1 ? pool[0]!.id : null;
}

export function statuteById(ctx: GraphContext, id: number) {
  return ctx.laws
    .prepare("SELECT id, short_title, official_title, kind, domain, act_number, status FROM statutes WHERE id = ?")
    .get(id) as
    | {
        id: number;
        short_title: string;
        official_title: string;
        kind: string;
        domain: string;
        act_number: string | null;
        status: string;
      }
    | undefined;
}

export function caseById(ctx: GraphContext, id: number) {
  return ctx.cases
    .prepare("SELECT id, citation, title, court, promulgation_date, ponente FROM cases WHERE id = ?")
    .get(id) as
    | {
        id: number;
        citation: string;
        title: string;
        court: string;
        promulgation_date: string | null;
        ponente: string | null;
      }
    | undefined;
}

export interface GraphEdge {
  citingKind: "case" | "statute";
  citingCaseId: number | null;
  citingStatuteId: number | null;
  citedKind: "case" | "statute";
  citedCaseId: number | null;
  citedStatuteId: number | null;
  citedReference: string;
}

interface CitationGraphRow {
  citing_kind: string;
  citing_case_id: number | null;
  citing_statute_id: number | null;
  cited_kind: string;
  cited_case_id: number | null;
  cited_statute_id: number | null;
  cited_reference: string;
}

/** Map raw citations_graph rows (snake_case) to the camelCase GraphEdge contract. */
function toGraphEdge(r: CitationGraphRow): GraphEdge {
  return {
    citingKind: r.citing_kind as GraphEdge["citingKind"],
    citingCaseId: r.citing_case_id,
    citingStatuteId: r.citing_statute_id,
    citedKind: r.cited_kind as GraphEdge["citedKind"],
    citedCaseId: r.cited_case_id,
    citedStatuteId: r.cited_statute_id,
    citedReference: r.cited_reference,
  };
}

const GRAPH_EDGE_COLUMNS =
  "citing_kind, citing_case_id, citing_statute_id, cited_kind, cited_case_id, cited_statute_id, cited_reference";

function edgeRows(ctx: GraphContext, sql: string, ...params: unknown[]): GraphEdge[] {
  const rows = ctx.cases.prepare(sql).all(...params) as CitationGraphRow[];
  return rows.map(toGraphEdge);
}

export function edgesFromCase(ctx: GraphContext, caseId: number): GraphEdge[] {
  return edgeRows(
    ctx,
    `SELECT ${GRAPH_EDGE_COLUMNS} FROM citations_graph
     WHERE citing_kind = 'case' AND citing_case_id = ? ORDER BY cited_reference`,
    caseId,
  );
}

export function edgesFromStatute(ctx: GraphContext, statuteId: number): GraphEdge[] {
  return edgeRows(
    ctx,
    `SELECT ${GRAPH_EDGE_COLUMNS} FROM citations_graph
     WHERE citing_kind = 'statute' AND citing_statute_id = ? ORDER BY cited_reference`,
    statuteId,
  );
}

export function casesCitingStatute(ctx: GraphContext, statuteId: number): Array<{ caseId: number }> {
  return ctx.cases
    .prepare(
      `SELECT DISTINCT citing_case_id AS caseId FROM citations_graph
       WHERE cited_kind = 'statute' AND cited_statute_id = ?`,
    )
    .all(statuteId) as Array<{ caseId: number }>;
}

export function amendmentsForStatute(ctx: GraphContext, statuteId: number) {
  return ctx.laws
    .prepare(
      `SELECT amending_law, amending_law_id, provision_no, effective_date, summary, note
       FROM amendments WHERE statute_id = ? ORDER BY effective_date`,
    )
    .all(statuteId) as Array<{
    amending_law: string;
    amending_law_id: number | null;
    provision_no: string | null;
    effective_date: string | null;
    summary: string | null;
    note: string | null;
  }>;
}

/** Edges citing the IRR of a statute (cited_reference mentions IRR). */
export function irrReferencesForStatute(ctx: GraphContext, statuteId: number): GraphEdge[] {
  return edgeRows(
    ctx,
    `SELECT ${GRAPH_EDGE_COLUMNS} FROM citations_graph
     WHERE cited_kind = 'statute' AND cited_statute_id = ?
       AND upper(cited_reference) LIKE '%IRR%'
     ORDER BY cited_reference`,
    statuteId,
  );
}

/** Statutes that cite the given statute (reverse law→law dependency edges). */
export function statutesCitingStatute(ctx: GraphContext, statuteId: number): Array<{ statuteId: number }> {
  return ctx.cases
    .prepare(
      `SELECT DISTINCT citing_statute_id AS statuteId FROM citations_graph
       WHERE citing_kind = 'statute' AND cited_kind = 'statute' AND cited_statute_id = ?`,
    )
    .all(statuteId) as Array<{ statuteId: number }>;
}

export function provisionHistory(ctx: GraphContext, statuteId: number, provisionNo: string) {
  return ctx.laws
    .prepare(
      `SELECT provision_no, heading, body, status, valid_from, valid_until
       FROM provisions WHERE statute_id = ? AND lower(provision_no) = lower(?)
       ORDER BY valid_from`,
    )
    .all(statuteId, provisionNo) as Array<{
    provision_no: string;
    heading: string | null;
    body: string;
    status: string;
    valid_from: string;
    valid_until: string | null;
  }>;
}
