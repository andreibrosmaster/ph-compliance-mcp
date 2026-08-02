import { describe, expect, it } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openCorpusDb } from "../../data-pipeline/db.js";
import { searchIssuances } from "../../src/retrieval/fts-search.js";
import { loadConfig } from "../../src/config.js";

function seededIssuancesDb() {
  const dir = mkdtempSync(join(tmpdir(), "ph-compliance-issuances-"));
  const db = openCorpusDb(join(dir, "issuances.sqlite"), "issuances");
  db.prepare(
    `INSERT INTO issuances (agency, issuance_type, reference_no, title, issue_date, source_url, content_hash, retrieved_at)
     VALUES ('BIR', 'Revenue Memorandum Circular', 'RMC 85-2023', 'Withholding tax on dividends', '2023-06-01', 'https://example.test/rmc', ?, ?)`,
  ).run("aa".repeat(32), "2026-08-02T00:00:00Z");
  const id = (db.prepare("SELECT id FROM issuances WHERE reference_no = ?").get("RMC 85-2023") as { id: number }).id;
  db.prepare(
    `INSERT INTO issuance_passages (issuance_id, passage_no, heading, body)
     VALUES (?, 1, NULL, 'The final withholding tax on cash and property dividends shall be fifteen percent (15%).')`,
  ).run(id);
  return db;
}

describe("searchIssuances (issuances corpus)", () => {
  it("finds passages and returns issuance metadata", () => {
    const db = seededIssuancesDb();
    const config = loadConfig({ PH_COMPLIANCE_CONFIDENCE_THRESHOLD: "0.2" });
    const { results } = searchIssuances(db, { query: "withholding tax dividends" }, config);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]!.agency).toBe("BIR");
    expect(results[0]!.referenceNo).toBe("RMC 85-2023");
    expect(results[0]!.issuanceType).toBe("Revenue Memorandum Circular");
    db.close();
  });

  it("respects the agency filter", () => {
    const db = seededIssuancesDb();
    const config = loadConfig({ PH_COMPLIANCE_CONFIDENCE_THRESHOLD: "0.2" });
    const { results } = searchIssuances(db, { query: "withholding", agency: "SSS" }, config);
    expect(results).toHaveLength(0);
    db.close();
  });

  it("reports pagination metadata", () => {
    const db = seededIssuancesDb();
    const config = loadConfig({ PH_COMPLIANCE_CONFIDENCE_THRESHOLD: "0.2" });
    const page = searchIssuances(db, { query: "withholding", limit: 5 }, config);
    expect(page.total).toBe(1);
    expect(page.hasMore).toBe(false);
    expect(page.nextOffset).toBeNull();
    db.close();
  });

  it("returns empty result set when nothing matches", () => {
    const db = seededIssuancesDb();
    const config = loadConfig({ PH_COMPLIANCE_CONFIDENCE_THRESHOLD: "0.2" });
    const page = searchIssuances(db, { query: "zzzznomatch" }, config);
    expect(page.total).toBe(0);
    expect(page.results).toHaveLength(0);
    db.close();
  });
});
