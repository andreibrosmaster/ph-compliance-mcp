/**
 * Shared types for the ingestion pipeline (blueprint §4/§5, constraint #5
 * provenance). Ingested raw documents are normalized into these records
 * before being written into laws.sqlite / cases.sqlite / issuances.sqlite.
 */

export interface Provenance {
  /** Canonical source URL the text was retrieved from. */
  sourceUrl: string;
  /** ISO-8601 retrieval date (time of the crawl, not of enactment). */
  retrievedAt: string;
  /** SHA-256 of the normalized text body. */
  contentHash: string;
}

/** A raw document as fetched from a source (before normalization). */
export interface RawDocument {
  sourceUrl: string;
  retrievedAt: string;
  title?: string;
  /** Raw text, possibly multi-page PDF text. */
  text: string;
  /** Original bytes hash, as fetched (pre-normalization). */
  rawHash: string;
}

/** One versioned provision of a statute (mirrors provisions table in laws.sql). */
export interface ProvisionRecord {
  provisionNo: string;
  heading?: string;
  body: string;
  status?: "in_force" | "amended" | "repealed" | "superseded";
  validFrom?: string;
  validUntil?: string | null;
}

/** A normalized statute ready for insert (mirrors statutes table). */
export interface StatuteRecord extends Provenance {
  shortTitle: string;
  officialTitle: string;
  kind: "constitution" | "code" | "republic_act" | "presidential_decree" | "executive_order" | "act" | "rules" | "other";
  /** Canonical enactment number used by the citation resolver, e.g. '386' (RA 386). */
  actNumber?: string;
  domain: string;
  enactedDate?: string;
  provisions: ProvisionRecord[];
}

/** A normalized case ready for insert (mirrors cases table). */
export interface CaseRecord extends Provenance {
  citation: string;
  title: string;
  court: "sc" | "ca" | "sb" | "cta" | "other";
  promulgationDate?: string;
  ponente?: string;
  division?: string;
  passages: PassageRecord[];
}

/**
 * A citation extracted from corpus text (Phase 4). `raw` is the exact text
 * span as written; resolution against the corpus happens in the resolver.
 */
export interface CitationSpan {
  kind: "statute" | "case";
  /** Raw citation text as it appears in the source, e.g. 'Art. 1156, Civil Code'. */
  raw: string;
  /** Canonical reference number for cases, e.g. 'G.R. No. 238875' or 'G.R. No. L-12345'. */
  caseCitation?: string;
  /** Statute act number when present, e.g. '386' (RA 386) or '442' (PD 442). */
  actNumber?: string;
  /** Statute short-title hint when cited by name, e.g. 'Civil Code of the Philippines'. */
  statuteTitle?: string;
  /** Provision number when cited at provision level, e.g. '1156' or '266-A'. */
  provisionNo?: string;
}

/** A normalized administrative issuance ready for insert (mirrors issuances table). */
export interface IssuanceRecord extends Provenance {
  agency: string;
  issuanceType: string;
  referenceNo: string;
  title?: string;
  issueDate?: string;
  passages: PassageRecord[];
}

export interface PassageRecord {
  passageNo: number;
  heading?: string;
  body: string;
}

/** Union of everything build-index can write. */
export type IngestibleRecord = StatuteRecord | CaseRecord | IssuanceRecord;
