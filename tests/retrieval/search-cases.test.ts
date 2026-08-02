import { describe, expect, it } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openCorpusDb } from "../../data-pipeline/db.js";
import { searchCases } from "../../src/retrieval/fts-search.js";
import { loadConfig } from "../../src/config.js";

function seededCasesDb() {
  const dir = mkdtempSync(join(tmpdir(), "ph-compliance-cases-"));
  const db = openCorpusDb(join(dir, "cases.sqlite"), "cases");
  db.prepare(
    `INSERT INTO cases (citation, title, court, promulgation_date, ponente, division, source_url, content_hash, retrieved_at)
     VALUES ('G.R. No. 238875', 'People v. Dela Cruz', 'sc', '2020-06-15', 'Inting, J.', 'Third Division', 'https://example.test/case', ?, ?)`,
  ).run("aa".repeat(32), "2026-08-02T00:00:00Z");
  const caseId = (db.prepare("SELECT id FROM cases WHERE citation = ?").get("G.R. No. 238875") as { id: number }).id;
  db.prepare(
    `INSERT INTO case_passages (case_id, passage_no, heading, body)
     VALUES (?, 1, NULL, 'The doctrine of piercing the corporate veil is equitable in nature.')`,
  ).run(caseId);
  return db;
}

describe("searchCases (cases corpus)", () => {
  it("finds passages and returns case metadata", () => {
    const db = seededCasesDb();
    const config = loadConfig({ PH_COMPLIANCE_CONFIDENCE_THRESHOLD: "0.2" });
    const { results } = searchCases(db, { query: "piercing the corporate veil" }, config);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]!.citation).toBe("G.R. No. 238875");
    expect(results[0]!.court).toBe("sc");
    db.close();
  });

  it("respects the court filter", () => {
    const db = seededCasesDb();
    const config = loadConfig({ PH_COMPLIANCE_CONFIDENCE_THRESHOLD: "0.2" });
    const { results } = searchCases(db, { query: "piercing", court: "ca" }, config);
    expect(results).toHaveLength(0);
    db.close();
  });

  it("reports pagination metadata", () => {
    const db = seededCasesDb();
    const config = loadConfig({ PH_COMPLIANCE_CONFIDENCE_THRESHOLD: "0.2" });
    const page = searchCases(db, { query: "piercing", limit: 5 }, config);
    expect(page.total).toBe(1);
    expect(page.hasMore).toBe(false);
    expect(page.nextOffset).toBeNull();
    db.close();
  });
});
