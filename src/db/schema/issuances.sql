-- issuances.sqlite — schema for administrative issuances (BIR first, Phase 3)
-- Phase 0 scaffold. Per ADR-003 this file stays empty/unused until Phase 3,
-- when BIR issuances (and later other agencies) are ingested.
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS issuances (
  id INTEGER PRIMARY KEY,
  agency TEXT NOT NULL,                 -- e.g. 'BIR'
  issuance_type TEXT NOT NULL,          -- e.g. 'Revenue Memorandum Circular', 'Revenue Regulations'
  reference_no TEXT NOT NULL,           -- e.g. 'RMC 85-2023'
  title TEXT,
  issue_date TEXT,                      -- ISO 8601
  status TEXT NOT NULL DEFAULT 'current'
    CHECK (status IN ('current','superseded','revoked')),
  source_url TEXT,
  content_hash TEXT,                    -- provenance: integrity of ingested text
  retrieved_at TEXT,                    -- provenance: retrieval date
  UNIQUE (agency, issuance_type, reference_no)
);

CREATE TABLE IF NOT EXISTS issuance_passages (
  id INTEGER PRIMARY KEY,
  issuance_id INTEGER NOT NULL REFERENCES issuances(id) ON DELETE CASCADE,
  passage_no INTEGER NOT NULL,          -- ordinal within the issuance
  heading TEXT,
  body TEXT NOT NULL,
  UNIQUE (issuance_id, passage_no)
);
CREATE INDEX IF NOT EXISTS idx_issuance_passages ON issuance_passages(issuance_id);

CREATE VIRTUAL TABLE IF NOT EXISTS issuance_passages_fts USING fts5(
  heading, body,
  content='issuance_passages', content_rowid='id',
  tokenize='unicode61'
);

-- FTS sync triggers (external-content pattern).
-- NOTE: FTS5 columns are implicitly NOT NULL, so NULLable source columns
-- (heading) are COALESCEd to '' in triggers to avoid NOT NULL constraint errors.
CREATE TRIGGER IF NOT EXISTS issuance_passages_ai AFTER INSERT ON issuance_passages BEGIN
  INSERT INTO issuance_passages_fts(rowid, heading, body)
  VALUES (new.id, COALESCE(new.heading, ''), new.body);
END;
CREATE TRIGGER IF NOT EXISTS issuance_passages_ad AFTER DELETE ON issuance_passages BEGIN
  INSERT INTO issuance_passages_fts(issuance_passages_fts, rowid, heading, body)
  VALUES ('delete', old.id, old.heading, old.body);
END;
CREATE TRIGGER IF NOT EXISTS issuance_passages_au AFTER UPDATE ON issuance_passages BEGIN
  INSERT INTO issuance_passages_fts(issuance_passages_fts, rowid, heading, body)
  VALUES ('delete', old.id, old.heading, old.body);
  INSERT INTO issuance_passages_fts(rowid, heading, body)
  VALUES (new.id, COALESCE(new.heading, ''), new.body);
END;
