/**
 * Corpus DB helpers for the pipeline. Executes the schema files from
 * src/db/schema/*.sql (Phase 0 artifacts) against fresh corpus files.
 */
import { mkdirSync } from "node:fs";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import type { CaseRecord, IssuanceRecord, StatuteRecord } from "./types.js";

const SCHEMA_DIR = fileURLToPath(new URL("../src/db/schema/", import.meta.url));

export type CorpusFile = "laws" | "cases" | "issuances";

/** Full path of a schema SQL file for a corpus file. */
export function schemaPath(corpus: CorpusFile): string {
  return join(SCHEMA_DIR, `${corpus}.sql`);
}

/** Open (create if needed) a corpus DB and apply its schema idempotently. */
export function openCorpusDb(dbPath: string, corpus: CorpusFile): Database.Database {
  mkdirSync(dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  const schema = readFileSync(schemaPath(corpus), "utf8");
  db.exec(schema);
  return db;
}

/** Insert a StatuteRecord into an open laws DB inside one transaction. */
export function insertStatute(db: Database.Database, rec: StatuteRecord): number {
  const insertStatuteStmt = db.prepare(
    `INSERT INTO statutes (short_title, official_title, kind, act_number, domain, enacted_date, status, source_url, content_hash, retrieved_at)
     VALUES (@shortTitle, @officialTitle, @kind, @actNumber, @domain, @enactedDate, 'in_force', @sourceUrl, @contentHash, @retrievedAt)`,
  );
  const insertProvisionStmt = db.prepare(
    `INSERT INTO provisions (statute_id, provision_no, heading, body, status, valid_from)
     VALUES (@statuteId, @provisionNo, @heading, @body, @status, @validFrom)`,
  );

  const tx = db.transaction((recInner: typeof rec) => {
    // better-sqlite3 rejects `undefined` bind values; coalesce optionals to null.
    const info = insertStatuteStmt.run({
      ...recInner,
      actNumber: recInner.actNumber ?? null,
      enactedDate: recInner.enactedDate ?? null,
    });
    const statuteId = Number(info.lastInsertRowid);
    for (const p of recInner.provisions) {
      insertProvisionStmt.run({
        statuteId,
        provisionNo: p.provisionNo,
        heading: p.heading ?? null,
        body: p.body,
        status: p.status ?? "in_force",
        validFrom: p.validFrom ?? recInner.enactedDate ?? new Date().toISOString().slice(0, 10),
      });
    }
    return statuteId;
  });
  return tx(rec);
}

/**
 * Insert a CaseRecord into an open cases DB inside one transaction (Phase 1;
 * Phase 4 populates citations_graph separately via the citation resolver).
 */
export function insertCase(db: Database.Database, rec: CaseRecord): number {
  const insertCaseStmt = db.prepare(
    `INSERT INTO cases (citation, title, court, promulgation_date, ponente, division, source_url, content_hash, retrieved_at)
     VALUES (@citation, @title, @court, @promulgationDate, @ponente, @division, @sourceUrl, @contentHash, @retrievedAt)`,
  );
  const insertPassageStmt = db.prepare(
    `INSERT INTO case_passages (case_id, passage_no, heading, body)
     VALUES (@caseId, @passageNo, @heading, @body)`,
  );

  const tx = db.transaction((recInner: typeof rec) => {
    // better-sqlite3 rejects `undefined` bind values; coalesce optionals to null.
    const info = insertCaseStmt.run({
      ...recInner,
      promulgationDate: recInner.promulgationDate ?? null,
      ponente: recInner.ponente ?? null,
      division: recInner.division ?? null,
    });
    const caseId = Number(info.lastInsertRowid);
    for (const p of recInner.passages) {
      insertPassageStmt.run({
        caseId,
        passageNo: p.passageNo,
        heading: p.heading ?? null,
        body: p.body,
      });
    }
    return caseId;
  });
  return tx(rec);
}

/** Insert an IssuanceRecord into an open issuances DB (Phase 3). */
export function insertIssuance(db: Database.Database, rec: IssuanceRecord): number {
  const insertIssuanceStmt = db.prepare(
    `INSERT INTO issuances (agency, issuance_type, reference_no, title, issue_date, source_url, content_hash, retrieved_at)
     VALUES (@agency, @issuanceType, @referenceNo, @title, @issueDate, @sourceUrl, @contentHash, @retrievedAt)`,
  );
  const insertPassageStmt = db.prepare(
    `INSERT INTO issuance_passages (issuance_id, passage_no, heading, body)
     VALUES (@issuanceId, @passageNo, @heading, @body)`,
  );

  const tx = db.transaction((recInner: typeof rec) => {
    const info = insertIssuanceStmt.run({
      agency: recInner.agency,
      issuanceType: recInner.issuanceType,
      referenceNo: recInner.referenceNo,
      title: recInner.title ?? null,
      issueDate: recInner.issueDate ?? null,
      sourceUrl: recInner.sourceUrl,
      contentHash: recInner.contentHash,
      retrievedAt: recInner.retrievedAt,
    });
    const issuanceId = Number(info.lastInsertRowid);
    for (const p of recInner.passages) {
      insertPassageStmt.run({
        issuanceId,
        passageNo: p.passageNo,
        heading: p.heading ?? null,
        body: p.body,
      });
    }
    return issuanceId;
  });
  return tx(rec);
}
