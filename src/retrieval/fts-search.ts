/**
 * fts-search (V1 retrieval path, ADR-002). FTS5/BM25 only — no vector search
 * until Phase 4/5. The tool contract stays identical when the method improves.
 *
 * Pagination (mcp-builder skill): search functions return `total`, `hasMore`,
 * and `nextOffset` alongside results so agents can page through large matches.
 */
import type Database from "better-sqlite3";
import type { Config } from "../config.js";
import { passesGate, queryTerms, scoreConfidence } from "./confidence.js";

export interface StatuteHit {
  statuteId: number;
  shortTitle: string;
  officialTitle: string;
  kind: string;
  domain: string;
  provisionId: number;
  provisionNo: string;
  heading: string | null;
  snippet: string;
  status: string;
  confidence: number;
  confidenceLevel: string;
}

export interface CaseHit {
  caseId: number;
  citation: string;
  title: string;
  court: string;
  promulgationDate: string | null;
  ponente: string | null;
  passageId: number;
  snippet: string;
  confidence: number;
  confidenceLevel: string;
}

export interface IssuanceHit {
  issuanceId: number;
  agency: string;
  issuanceType: string;
  referenceNo: string;
  title: string | null;
  issueDate: string | null;
  passageId: number;
  snippet: string;
  confidence: number;
  confidenceLevel: string;
}

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

export function searchStatutes(
  db: Database.Database,
  params: SearchParams,
  config: Config,
): SearchOutcome<StatuteHit> {
  const limit = Math.min(params.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
  const offset = Math.max(0, params.offset ?? 0);
  const match = toMatchExpression(params.query);
  if (!match) return { results: [], query: params.query, total: 0, offset, hasMore: false, nextOffset: null };

  const where = params.domain ? "AND s.domain = ?" : "";
  const baseArgs = [match, ...(params.domain ? [params.domain] : [])];

  const totalRow = db
    .prepare(
      `SELECT count(*) AS n
       FROM provisions_fts f
       JOIN provisions p ON p.id = f.rowid
       JOIN statutes s ON s.id = p.statute_id
       WHERE provisions_fts MATCH ? ${where}`,
    )
    .get(...baseArgs) as { n: number };
  const total = totalRow.n;

  const sql = `
    SELECT s.id AS statute_id, s.short_title, s.official_title, s.kind, s.domain,
           p.id AS provision_id, p.provision_no, p.heading, p.body,
           p.status, bm25(provisions_fts) AS bm
    FROM provisions_fts f
    JOIN provisions p ON p.id = f.rowid
    JOIN statutes s ON s.id = p.statute_id
    WHERE provisions_fts MATCH ? ${where}
    ORDER BY bm
    LIMIT ? OFFSET ?
  `;
  const rows = db.prepare(sql).all(...baseArgs, limit, offset) as Array<{
    statute_id: number;
    short_title: string;
    official_title: string;
    kind: string;
    domain: string;
    provision_id: number;
    provision_no: string;
    heading: string | null;
    body: string;
    status: string;
    bm: number;
  }>;

  const terms = queryTerms(params.query);
  const results: StatuteHit[] = [];
  for (const r of rows) {
    const bodyLower = r.body.toLowerCase();
    const matched = terms.filter((t) => bodyLower.includes(t)).length;
    const confidence = scoreConfidence({
      bm25Score: r.bm,
      termCoverage: terms.length > 0 ? matched / terms.length : 0,
      exactPhrase: terms.length > 0 && r.body.toLowerCase().includes(params.query.toLowerCase()),
      headingMatch: r.heading ? r.heading.toLowerCase().includes(params.query.toLowerCase()) : false,
    });
    if (!passesGate(confidence, config)) continue;
    results.push({
      statuteId: r.statute_id,
      shortTitle: r.short_title,
      officialTitle: r.official_title,
      kind: r.kind,
      domain: r.domain,
      provisionId: r.provision_id,
      provisionNo: r.provision_no,
      heading: r.heading,
      snippet: snippet(r.body, params.query),
      status: r.status,
      confidence: confidence.score,
      confidenceLevel: confidence.level,
    });
  }
  return outcome(results, params.query, total, offset);
}

export function searchCases(
  db: Database.Database,
  params: SearchParams,
  config: Config,
): SearchOutcome<CaseHit> {
  const limit = Math.min(params.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
  const offset = Math.max(0, params.offset ?? 0);
  const match = toMatchExpression(params.query);
  if (!match) return { results: [], query: params.query, total: 0, offset, hasMore: false, nextOffset: null };

  const where = params.court ? "AND c.court = ?" : "";
  const baseArgs = [match, ...(params.court ? [params.court] : [])];

  const totalRow = db
    .prepare(
      `SELECT count(*) AS n
       FROM case_passages_fts f
       JOIN case_passages p ON p.id = f.rowid
       JOIN cases c ON c.id = p.case_id
       WHERE case_passages_fts MATCH ? ${where}`,
    )
    .get(...baseArgs) as { n: number };
  const total = totalRow.n;

  const sql = `
    SELECT c.id AS case_id, c.citation, c.title, c.court, c.promulgation_date,
           c.ponente, p.id AS passage_id, p.body, bm25(case_passages_fts) AS bm
    FROM case_passages_fts f
    JOIN case_passages p ON p.id = f.rowid
    JOIN cases c ON c.id = p.case_id
    WHERE case_passages_fts MATCH ? ${where}
    ORDER BY bm
    LIMIT ? OFFSET ?
  `;
  const rows = db.prepare(sql).all(...baseArgs, limit, offset) as Array<{
    case_id: number;
    citation: string;
    title: string;
    court: string;
    promulgation_date: string | null;
    ponente: string | null;
    passage_id: number;
    body: string;
    bm: number;
  }>;

  const terms = queryTerms(params.query);
  const results: CaseHit[] = [];
  for (const r of rows) {
    const bodyLower = r.body.toLowerCase();
    const matched = terms.filter((t) => bodyLower.includes(t)).length;
    const confidence = scoreConfidence({
      bm25Score: r.bm,
      termCoverage: terms.length > 0 ? matched / terms.length : 0,
      exactPhrase: r.body.toLowerCase().includes(params.query.toLowerCase()),
      headingMatch: false,
    });
    if (!passesGate(confidence, config)) continue;
    results.push({
      caseId: r.case_id,
      citation: r.citation,
      title: r.title,
      court: r.court,
      promulgationDate: r.promulgation_date,
      ponente: r.ponente,
      passageId: r.passage_id,
      snippet: snippet(r.body, params.query),
      confidence: confidence.score,
      confidenceLevel: confidence.level,
    });
  }
  return outcome(results, params.query, total, offset);
}

export function searchIssuances(
  db: Database.Database,
  params: SearchParams,
  config: Config,
): SearchOutcome<IssuanceHit> {
  const limit = Math.min(params.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
  const offset = Math.max(0, params.offset ?? 0);
  const match = toMatchExpression(params.query);
  if (!match) return { results: [], query: params.query, total: 0, offset, hasMore: false, nextOffset: null };

  const conditions: string[] = [];
  const baseArgs: (string | number)[] = [match];
  if (params.agency) {
    conditions.push("i.agency = ?");
    baseArgs.push(params.agency);
  }
  if (params.issuanceType) {
    conditions.push("i.issuance_type = ?");
    baseArgs.push(params.issuanceType);
  }
  const where = conditions.length > 0 ? `AND ${conditions.join(" AND ")}` : "";

  const totalRow = db
    .prepare(
      `SELECT count(*) AS n
       FROM issuance_passages_fts f
       JOIN issuance_passages p ON p.id = f.rowid
       JOIN issuances i ON i.id = p.issuance_id
       WHERE issuance_passages_fts MATCH ? ${where}`,
    )
    .get(...baseArgs) as { n: number };
  const total = totalRow.n;

  const sql = `
    SELECT i.id AS issuance_id, i.agency, i.issuance_type, i.reference_no,
           i.title, i.issue_date, p.id AS passage_id, p.body,
           bm25(issuance_passages_fts) AS bm
    FROM issuance_passages_fts f
    JOIN issuance_passages p ON p.id = f.rowid
    JOIN issuances i ON i.id = p.issuance_id
    WHERE issuance_passages_fts MATCH ? ${where}
    ORDER BY bm
    LIMIT ? OFFSET ?
  `;
  const rows = db.prepare(sql).all(...baseArgs, limit, offset) as Array<{
    issuance_id: number;
    agency: string;
    issuance_type: string;
    reference_no: string;
    title: string | null;
    issue_date: string | null;
    passage_id: number;
    body: string;
    bm: number;
  }>;

  const terms = queryTerms(params.query);
  const results: IssuanceHit[] = [];
  for (const r of rows) {
    const bodyLower = r.body.toLowerCase();
    const matched = terms.filter((t) => bodyLower.includes(t)).length;
    const confidence = scoreConfidence({
      bm25Score: r.bm,
      termCoverage: terms.length > 0 ? matched / terms.length : 0,
      exactPhrase: r.body.toLowerCase().includes(params.query.toLowerCase()),
      headingMatch: false,
    });
    if (!passesGate(confidence, config)) continue;
    results.push({
      issuanceId: r.issuance_id,
      agency: r.agency,
      issuanceType: r.issuance_type,
      referenceNo: r.reference_no,
      title: r.title,
      issueDate: r.issue_date,
      passageId: r.passage_id,
      snippet: snippet(r.body, params.query),
      confidence: confidence.score,
      confidenceLevel: confidence.level,
    });
  }
  return outcome(results, params.query, total, offset);
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
