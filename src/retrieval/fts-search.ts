/**
 * fts-search — public retrieval API over the three corpora (ADR-002). Each
 * search function is a small spec over the shared engine in fts-core.ts; the
 * tool contract stays identical when the retrieval method improves (Phase 5).
 */
import type Database from "better-sqlite3";
import type { Config } from "../config.js";
import { searchCorpus } from "./fts-core.js";
import type { CorpusSpec, SearchOutcome, SearchParams } from "./fts-core.js";

export type { SearchOutcome, SearchParams };
export { toMatchExpression, snippet } from "./fts-core.js";

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

interface StatuteRow {
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
}

interface CaseRow {
  case_id: number;
  citation: string;
  title: string;
  court: string;
  promulgation_date: string | null;
  ponente: string | null;
  passage_id: number;
  body: string;
  bm: number;
}

interface IssuanceRow {
  issuance_id: number;
  agency: string;
  issuance_type: string;
  reference_no: string;
  title: string | null;
  issue_date: string | null;
  passage_id: number;
  body: string;
  bm: number;
}

const statutesSpec: CorpusSpec<StatuteRow, StatuteHit> = {
  ftsTable: "provisions_fts",
  joins: "JOIN provisions p ON p.id = f.rowid\nJOIN statutes s ON s.id = p.statute_id",
  select: `s.id AS statute_id, s.short_title, s.official_title, s.kind, s.domain,
           p.id AS provision_id, p.provision_no, p.heading, p.body,
           p.status, bm25(provisions_fts) AS bm`,
  filters: (params: SearchParams) =>
    params.domain
      ? { sql: "AND s.domain = ?", args: [params.domain] }
      : { sql: "", args: [] },
  headingOf: (row) => row.heading,
  toHit: (row, ctx) => ({
    statuteId: row.statute_id,
    shortTitle: row.short_title,
    officialTitle: row.official_title,
    kind: row.kind,
    domain: row.domain,
    provisionId: row.provision_id,
    provisionNo: row.provision_no,
    heading: row.heading,
    snippet: ctx.snippet,
    status: row.status,
    confidence: ctx.confidence.score,
    confidenceLevel: ctx.confidence.level,
  }),
};

const casesSpec: CorpusSpec<CaseRow, CaseHit> = {
  ftsTable: "case_passages_fts",
  joins: "JOIN case_passages p ON p.id = f.rowid\nJOIN cases c ON c.id = p.case_id",
  select: `c.id AS case_id, c.citation, c.title, c.court, c.promulgation_date,
           c.ponente, p.id AS passage_id, p.body,
           bm25(case_passages_fts) AS bm`,
  filters: (params: SearchParams) =>
    params.court
      ? { sql: "AND c.court = ?", args: [params.court] }
      : { sql: "", args: [] },
  headingOf: () => null,
  toHit: (row, ctx) => ({
    caseId: row.case_id,
    citation: row.citation,
    title: row.title,
    court: row.court,
    promulgationDate: row.promulgation_date,
    ponente: row.ponente,
    passageId: row.passage_id,
    snippet: ctx.snippet,
    confidence: ctx.confidence.score,
    confidenceLevel: ctx.confidence.level,
  }),
};

const issuancesSpec: CorpusSpec<IssuanceRow, IssuanceHit> = {
  ftsTable: "issuance_passages_fts",
  joins: "JOIN issuance_passages p ON p.id = f.rowid\nJOIN issuances i ON i.id = p.issuance_id",
  select: `i.id AS issuance_id, i.agency, i.issuance_type, i.reference_no,
           i.title, i.issue_date, p.id AS passage_id, p.body,
           bm25(issuance_passages_fts) AS bm`,
  filters: (params: SearchParams) => {
    const conditions: string[] = [];
    const args: (string | number)[] = [];
    if (params.agency) {
      conditions.push("i.agency = ?");
      args.push(params.agency);
    }
    if (params.issuanceType) {
      conditions.push("i.issuance_type = ?");
      args.push(params.issuanceType);
    }
    return { sql: conditions.length > 0 ? `AND ${conditions.join(" AND ")}` : "", args };
  },
  headingOf: () => null,
  toHit: (row, ctx) => ({
    issuanceId: row.issuance_id,
    agency: row.agency,
    issuanceType: row.issuance_type,
    referenceNo: row.reference_no,
    title: row.title,
    issueDate: row.issue_date,
    passageId: row.passage_id,
    snippet: ctx.snippet,
    confidence: ctx.confidence.score,
    confidenceLevel: ctx.confidence.level,
  }),
};

export function searchStatutes(
  db: Database.Database,
  params: SearchParams,
  config: Config,
): SearchOutcome<StatuteHit> {
  return searchCorpus(db, params, config, statutesSpec);
}

export function searchCases(
  db: Database.Database,
  params: SearchParams,
  config: Config,
): SearchOutcome<CaseHit> {
  return searchCorpus(db, params, config, casesSpec);
}

export function searchIssuances(
  db: Database.Database,
  params: SearchParams,
  config: Config,
): SearchOutcome<IssuanceHit> {
  return searchCorpus(db, params, config, issuancesSpec);
}
