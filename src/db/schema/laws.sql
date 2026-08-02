-- laws.sqlite — schema for Philippine statutes and other legal instruments
-- Phase 0 scaffold (ADR-003). Refined during Phase 1 (pipeline) as real data
-- shapes land. FTS5 only (ADR-002); embeddings arrive in Phase 4/5 via a 4th
-- ATTACHed file (embeddings.sqlite).
PRAGMA foreign_keys = ON;

-- The 15-domain compliance taxonomy (ADR-000 core 11 + ADR-004 compliance
-- expansion). Backs list_domains.
CREATE TABLE IF NOT EXISTS domains (
  slug TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT
);

INSERT OR IGNORE INTO domains (slug, name, description) VALUES
  ('constitutional', 'Constitutional Law', '1987 Constitution; highest-norm anchor, cited cross-domain'),
  ('civil', 'Civil Law', 'Civil Code (RA 386) and amendments'),
  ('family', 'Family Code', 'Family Code (EO 209, as amended)'),
  ('criminal', 'Criminal Law', 'Revised Penal Code (Act 3815) and special penal laws'),
  ('tax', 'Tax Law', 'National Internal Revenue Code (RA 8424, as amended)'),
  ('labor', 'Labor Law', 'Labor Code (PD 442) and related statutes'),
  ('commercial-corporate', 'Commercial/Corporate Law', 'Revised Corporation Code (RA 11232), Securities Regulation Code, etc.'),
  ('business-transactional', 'Business & Transactional Law', 'Contracts, sales, agency, credit, negotiable instruments, EODB (RA 11032)'),
  ('accounting', 'Accounting & Auditing Law', 'Accountancy Act (RA 9298), PFRS, COA audit rules'),
  ('payroll', 'Payroll & Benefits Law', '13th month pay (PD 851), SSS/PhilHealth/Pag-IBIG, withholding on compensation'),
  ('human-resources', 'HR & Workplace Compliance', 'DOLE issuances, labor standards, OSH (RA 11058), termination rules'),
  ('remedial', 'Remedial Law', 'Rules of Court and rules of procedure/evidence'),
  ('administrative', 'Administrative Law', 'Administrative Code of 1987 (EO 292), civil-service rules, NGA memorandums'),
  ('local-government', 'Local Government Law', 'Local Government Code (RA 7160), LGU issuances and ordinances'),
  ('special', 'Special/Cross-Cutting Laws', 'Data Privacy Act (RA 10173), Ease of Doing Business Act (RA 11032), etc.');

-- A statute or legal instrument. Version-aware: status tracks life-cycle.
CREATE TABLE IF NOT EXISTS statutes (
  id INTEGER PRIMARY KEY,
  short_title TEXT NOT NULL,
  official_title TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('constitution','code','republic_act','presidential_decree','executive_order','act','rules','other')),
  -- Canonical enactment number used by the citation resolver, e.g. '386'
  -- (RA 386 / Civil Code), '442' (PD 442 / Labor Code), '292' (EO 292).
  -- NULL for instruments cited by name only (e.g. the 1987 Constitution).
  act_number TEXT,
  domain TEXT NOT NULL REFERENCES domains(slug),
  enacted_date TEXT,                    -- ISO 8601
  status TEXT NOT NULL DEFAULT 'in_force'
    CHECK (status IN ('in_force','amended','repealed','superseded')),
  source_url TEXT,
  content_hash TEXT,                    -- provenance: integrity of ingested text
  retrieved_at TEXT,                    -- provenance: retrieval date
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Provision text, versioned. valid_from/valid_until model amendments without
-- destroying history (constraint #4: version-aware, not just current-aware).
CREATE TABLE IF NOT EXISTS provisions (
  id INTEGER PRIMARY KEY,
  statute_id INTEGER NOT NULL REFERENCES statutes(id) ON DELETE CASCADE,
  provision_no TEXT NOT NULL,           -- e.g. 'Art. 2', 'Sec. 5(b)'
  heading TEXT,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'in_force'
    CHECK (status IN ('in_force','amended','repealed','superseded')),
  valid_from TEXT NOT NULL,             -- effective date of this text version
  valid_until TEXT,                     -- NULL = current version
  UNIQUE (statute_id, provision_no, valid_from)  -- covers statute_id prefix lookups; no extra index needed
);

-- External-content FTS5 (BM25 for V1 retrieval).
CREATE VIRTUAL TABLE IF NOT EXISTS provisions_fts USING fts5(
  provision_no, heading, body,
  content='provisions', content_rowid='id',
  tokenize='unicode61'
);

-- FTS sync triggers (external-content pattern: delete-then-insert on update).
-- NOTE: FTS5 columns are implicitly NOT NULL, so NULLable source columns
-- (heading) are COALESCEd to '' in triggers to avoid NOT NULL constraint errors.
CREATE TRIGGER IF NOT EXISTS provisions_ai AFTER INSERT ON provisions BEGIN
  INSERT INTO provisions_fts(rowid, provision_no, heading, body)
  VALUES (new.id, new.provision_no, COALESCE(new.heading, ''), new.body);
END;
CREATE TRIGGER IF NOT EXISTS provisions_ad AFTER DELETE ON provisions BEGIN
  INSERT INTO provisions_fts(provisions_fts, rowid, provision_no, heading, body)
  VALUES ('delete', old.id, old.provision_no, old.heading, old.body);
END;
CREATE TRIGGER IF NOT EXISTS provisions_au AFTER UPDATE ON provisions BEGIN
  INSERT INTO provisions_fts(provisions_fts, rowid, provision_no, heading, body)
  VALUES ('delete', old.id, old.provision_no, old.heading, old.body);
  INSERT INTO provisions_fts(rowid, provision_no, heading, body)
  VALUES (new.id, new.provision_no, COALESCE(new.heading, ''), new.body);
END;

-- Amendment log. Feeds Phase 4 graph tools (show_amendments, show_history).
CREATE TABLE IF NOT EXISTS amendments (
  id INTEGER PRIMARY KEY,
  statute_id INTEGER NOT NULL REFERENCES statutes(id) ON DELETE CASCADE,
  amending_law TEXT NOT NULL,           -- e.g. 'RA 11466'
  amending_law_id INTEGER REFERENCES statutes(id),
  provision_no TEXT,
  effective_date TEXT,
  summary TEXT,
  note TEXT
);
