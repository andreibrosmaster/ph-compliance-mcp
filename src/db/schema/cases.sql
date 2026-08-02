-- cases.sqlite — schema for Philippine jurisprudence
-- Phase 0 scaffold (ADR-003). Refined during Phase 1/4 as real case data
-- shapes land (jurisprudence at scale is a Phase 4 milestone).
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS cases (
  id INTEGER PRIMARY KEY,
  citation TEXT NOT NULL,               -- e.g. 'G.R. No. 238875'
  title TEXT NOT NULL,                  -- e.g. 'People v. Dela Cruz'
  court TEXT NOT NULL CHECK (court IN ('sc','ca','sb','cta','other')),
  promulgation_date TEXT,               -- ISO 8601
  ponente TEXT,
  division TEXT,                        -- e.g. 'En Banc', 'Third Division'
  status TEXT NOT NULL DEFAULT 'reported',
  source_url TEXT,
  content_hash TEXT,                    -- provenance: integrity of ingested text
  retrieved_at TEXT,                    -- provenance: retrieval date
  UNIQUE (citation)
);

-- Chunked passages of a decision, searchable via FTS5.
CREATE TABLE IF NOT EXISTS case_passages (
  id INTEGER PRIMARY KEY,
  case_id INTEGER NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  passage_no INTEGER NOT NULL,          -- ordinal within the case
  heading TEXT,
  body TEXT NOT NULL,
  UNIQUE (case_id, passage_no)
);
CREATE INDEX IF NOT EXISTS idx_passages_case ON case_passages(case_id);

CREATE VIRTUAL TABLE IF NOT EXISTS case_passages_fts USING fts5(
  heading, body,
  content='case_passages', content_rowid='id',
  tokenize='unicode61'
);

-- FTS sync triggers (external-content pattern).
-- NOTE: FTS5 columns are implicitly NOT NULL, so NULLable source columns
-- (heading) are COALESCEd to '' in triggers to avoid NOT NULL constraint errors.
CREATE TRIGGER IF NOT EXISTS case_passages_ai AFTER INSERT ON case_passages BEGIN
  INSERT INTO case_passages_fts(rowid, heading, body)
  VALUES (new.id, COALESCE(new.heading, ''), new.body);
END;
CREATE TRIGGER IF NOT EXISTS case_passages_ad AFTER DELETE ON case_passages BEGIN
  INSERT INTO case_passages_fts(case_passages_fts, rowid, heading, body)
  VALUES ('delete', old.id, old.heading, old.body);
END;
CREATE TRIGGER IF NOT EXISTS case_passages_au AFTER UPDATE ON case_passages BEGIN
  INSERT INTO case_passages_fts(case_passages_fts, rowid, heading, body)
  VALUES ('delete', old.id, old.heading, old.body);
  INSERT INTO case_passages_fts(rowid, heading, body)
  VALUES (new.id, COALESCE(new.heading, ''), new.body);
END;

-- Citation graph (Phase 4): which case/statute cites which law/case. Populated
-- during jurisprudence-at-scale; backs the Phase 4 graph tools
-- (related_laws, related_cases, show_amendments, show_history,
-- show_dependencies, show_citations, show_implementing_rules,
-- show_cross_references).
--
-- A row is an edge: citing (case or statute) → cited (case or statute).
-- Statute ids are cross-DB (laws.sqlite); they are NOT foreign keys here so
-- that cases.sqlite stays standalone. Only citations that RESOLVE against the
-- corpus are recorded (constraint #1: never a best-effort guess).
CREATE TABLE IF NOT EXISTS citations_graph (
  id INTEGER PRIMARY KEY,
  citing_kind TEXT NOT NULL CHECK (citing_kind IN ('case','statute')),
  citing_case_id INTEGER REFERENCES cases(id) ON DELETE CASCADE,
  citing_statute_id INTEGER,            -- cross-DB; resolved via laws.sqlite by loader
  cited_kind TEXT NOT NULL CHECK (cited_kind IN ('statute','case')),
  cited_case_id INTEGER REFERENCES cases(id) ON DELETE CASCADE,
  cited_statute_id INTEGER,             -- cross-DB; resolved via laws.sqlite by loader
  cited_reference TEXT NOT NULL,        -- raw citation string as it appears, e.g. 'Art. 1861, Civil Code'
  -- kind must match which id is populated: a 'case' edge owns citing_case_id,
  -- a 'statute' edge owns citing_statute_id. No mixed rows (self-enforcing
  -- invariant so graph tools can trust citing_kind).
  CHECK (
    (citing_kind = 'case' AND citing_case_id IS NOT NULL AND citing_statute_id IS NULL)
    OR (citing_kind = 'statute' AND citing_statute_id IS NOT NULL AND citing_case_id IS NULL)
  ),
  CHECK (
    (cited_kind = 'case' AND cited_case_id IS NOT NULL AND cited_statute_id IS NULL)
    OR (cited_kind = 'statute' AND cited_statute_id IS NOT NULL AND cited_case_id IS NULL)
  )
);
-- Dedupe edges: COALESCE -1 for NULL ids so SQLite's UNIQUE treats
-- (case-citing, statute-cited) rows consistently.
CREATE UNIQUE INDEX IF NOT EXISTS idx_citations_graph_unique ON citations_graph(
  COALESCE(citing_case_id, -1), COALESCE(citing_statute_id, -1),
  COALESCE(cited_case_id, -1), COALESCE(cited_statute_id, -1)
);
CREATE INDEX IF NOT EXISTS idx_citations_graph_citing ON citations_graph(citing_case_id, citing_statute_id);
CREATE INDEX IF NOT EXISTS idx_citations_graph_cited ON citations_graph(cited_case_id, cited_statute_id, cited_kind);
CREATE INDEX IF NOT EXISTS idx_citations_graph_reference ON citations_graph(cited_reference);
