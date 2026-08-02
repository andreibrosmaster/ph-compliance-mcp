import { describe, expect, it } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { openCorpusDb, insertStatute } from "../../data-pipeline/db.js";

describe("corpus DB build", () => {
  it("applies schema idempotently and inserts statutes with FTS rows", () => {
    const dir = mkdtempSync(join(tmpdir(), "ph-compliance-db-"));
    const db = openCorpusDb(join(dir, "laws.sqlite"), "laws");
    openCorpusDb(join(dir, "laws.sqlite"), "laws"); // idempotent re-run

    const statuteId = insertStatute(db, {
      sourceUrl: "https://example.test/law",
      retrievedAt: "2026-08-02T00:00:00Z",
      contentHash: "ab".repeat(32),
      shortTitle: "Test Code",
      officialTitle: "Test Code of 2026",
      kind: "code",
      domain: "civil",
      provisions: [
        { provisionNo: "1", heading: "Intro", body: "First provision text" },
        { provisionNo: "2", body: "Second provision" },
      ],
    });

    expect(statuteId).toBeGreaterThan(0);
    const provisions = db
      .prepare("SELECT provision_no, body FROM provisions WHERE statute_id = ?")
      .all(statuteId);
    expect(provisions).toHaveLength(2);

    // FTS trigger must have indexed the rows (external-content table).
    const ftsHit = db
      .prepare("SELECT count(*) AS n FROM provisions_fts WHERE provisions_fts MATCH 'provision'")
      .get() as { n: number };
    expect(ftsHit.n).toBeGreaterThan(0);

    db.close();
  });

  it("seeds the 15-domain compliance taxonomy", () => {
    const dir = mkdtempSync(join(tmpdir(), "ph-compliance-db-"));
    const db = openCorpusDb(join(dir, "laws.sqlite"), "laws");
    const domains = db.prepare("SELECT slug FROM domains").all() as Array<{ slug: string }>;
    expect(domains.length).toBe(15);
    db.close();
  });

  it("requires a valid db path per corpus schema", () => {
    const dir = mkdtempSync(join(tmpdir(), "ph-compliance-db-"));
    const db = openCorpusDb(join(dir, "cases.sqlite"), "cases");
    const hasCases = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='cases'")
      .get();
    expect(hasCases).toBeTruthy();
    db.close();
  });

  it("handles a database instance type correctly (types smoke)", () => {
    const dir = mkdtempSync(join(tmpdir(), "ph-compliance-db-"));
    const db: Database.Database = openCorpusDb(join(dir, "laws.sqlite"), "laws");
    expect(db.open).toBe(true);
    db.close();
  });
});
