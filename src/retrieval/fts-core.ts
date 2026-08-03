/**
 * fts-core — shared FTS5/BM25 search engine (ADR-002). The three corpus
 * searches (statutes, cases, issuances) are the same query shape against
 * different tables, so the mechanics live here once; each corpus is a small
 * spec (joins, columns, filters, row→hit mapping) passed to searchCorpus.
 *
 * Pagination (mcp-builder skill): search functions return `total`, `hasMore`,
 * and `nextOffset` alongside results so agents can page through large matches.
 */
import type Database from "better-sqlite3";
import type { Config } from "../config.js";
import type { Confidence } from "./confidence.js";
import { passesGate, queryTerms, scoreConfidence } from "./confidence.js";

export interface SearchParams {
  query: string;
  domain?: string;
  court?: string;
  agency?: string;
  issuanceType?: string;
  limit?: number;
  offset?: number;
}

export interface SearchOutcome<T> {
  results: T[];
  query: string;
  /** Total corpus matches for the query (pre-confidence-gate, post-filter). */
  total: number;
  offset: number;
  hasMore: boolean;
  nextOffset: number | null;
}

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;

/** Escape user input into a safe FTS5 MATCH expression (AND of quoted terms). */
export function toMatchExpression(query: string): string {
  const terms = queryTerms(query);
  if (terms.length === 0) return "";
  // Quote each term; FTS5 treats quoted strings as exact phrases, which also
  // neutralizes any FTS syntax in user input.
  return terms.map((t) => `"${t.replace(/"/g, "")}"`).join(" AND ");
}

/** Build a compact snippet around the first query-term hit. */
export function snippet(body: string, query: string, radius = 160): string {
  const lower = body.toLowerCase();
  const firstTerm = queryTerms(query)[0];
  let idx = 0;
  if (firstTerm) {
    const hit = lower.indexOf(firstTerm);
    if (hit >= 0) idx = hit;
  }
  const start = Math.max(0, idx - radius / 2);
  const end = Math.min(body.length, idx + radius);
  const prefix = start > 0 ? "…" : "";
  const suffix = end < body.length ? "…" : "";
  return `${prefix}${body.slice(start, end)}${suffix}`;
}

function outcome<T>(
  results: T[],
  query: string,
  total: number,
  offset: number,
): SearchOutcome<T> {
  const hasMore = offset + results.length < total;
  return {
    results,
    query,
    total,
    offset,
    hasMore,
    nextOffset: hasMore ? offset + results.length : null,
  };
}

/** Row shape every corpus spec must satisfy. */
export interface FtsRow {
  bm: number;
  body: string;
}

/** One corpus's search description for the shared engine. */
export interface CorpusSpec<TRow extends FtsRow, THit> {
  /** FTS5 table name; also the MATCH target. */
  ftsTable: string;
  /** JOIN clauses from the FTS table (aliased `f`) to entity/passage tables. */
  joins: string;
  /** SELECT column list, ending with `bm25(<ftsTable>) AS bm`. */
  select: string;
  /** Extra AND-filter + args (domain/court/agency/type), `sql` may be "". */
  filters: (params: SearchParams) => { sql: string; args: (string | number)[] };
  /** Heading text for the heading-match confidence feature (null if none). */
  headingOf: (row: TRow) => string | null;
  /** Map a row to its public hit shape. */
  toHit: (row: TRow, ctx: { snippet: string; confidence: Confidence }) => THit;
}

/**
 * Run one FTS5 search against a corpus described by `spec`: count total
 * matches (pre-confidence-gate, post-filter), fetch a page, score each row
 * with the confidence gate, and drop rows below the configured threshold.
 */
export function searchCorpus<TRow extends FtsRow, THit>(
  db: Database.Database,
  params: SearchParams,
  config: Config,
  spec: CorpusSpec<TRow, THit>,
): SearchOutcome<THit> {
  const limit = Math.min(params.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
  const offset = Math.max(0, params.offset ?? 0);
  const match = toMatchExpression(params.query);
  if (!match) {
    return { results: [], query: params.query, total: 0, offset, hasMore: false, nextOffset: null };
  }

  const { sql: filterSql, args: filterArgs } = spec.filters(params);
  const baseArgs = [match, ...filterArgs];

  const totalRow = db
    .prepare(
      `SELECT count(*) AS n
       FROM ${spec.ftsTable} f
       ${spec.joins}
       WHERE ${spec.ftsTable} MATCH ? ${filterSql}`,
    )
    .get(...baseArgs) as { n: number };
  const total = totalRow.n;

  const rows = db
    .prepare(
      `SELECT ${spec.select}
       FROM ${spec.ftsTable} f
       ${spec.joins}
       WHERE ${spec.ftsTable} MATCH ? ${filterSql}
       ORDER BY bm
       LIMIT ? OFFSET ?`,
    )
    .all(...baseArgs, limit, offset) as TRow[];

  const terms = queryTerms(params.query);
  const queryLower = params.query.toLowerCase();
  const results: THit[] = [];
  for (const r of rows) {
    const bodyLower = r.body.toLowerCase();
    const matched = terms.filter((t) => bodyLower.includes(t)).length;
    const heading = spec.headingOf(r);
    const confidence = scoreConfidence({
      bm25Score: r.bm,
      termCoverage: terms.length > 0 ? matched / terms.length : 0,
      exactPhrase: bodyLower.includes(queryLower),
      headingMatch: heading !== null && heading.toLowerCase().includes(queryLower),
    });
    if (!passesGate(confidence, config)) continue;
    results.push(spec.toHit(r, { snippet: snippet(r.body, params.query), confidence }));
  }
  return outcome(results, params.query, total, offset);
}
