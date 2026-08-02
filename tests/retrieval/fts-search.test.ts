import { describe, expect, it } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openCorpusDb, insertStatute } from "../../data-pipeline/db.js";
import { searchStatutes, toMatchExpression } from "../../src/retrieval/fts-search.js";
import { loadConfig } from "../../src/config.js";
import type { StatuteRecord } from "../../data-pipeline/types.js";

function seededDb() {
  const dir = mkdtempSync(join(tmpdir(), "ph-compliance-fts-"));
  const db = openCorpusDb(join(dir, "laws.sqlite"), "laws");
  const rec: StatuteRecord = {
    sourceUrl: "https://example.test/law",
    retrievedAt: "2026-08-02T00:00:00Z",
    contentHash: "aa".repeat(32),
    shortTitle: "Civil Code of the Philippines",
    officialTitle: "An Act to Ordain and Institute the Civil Code",
    kind: "code",
    domain: "civil",
    provisions: [
      { provisionNo: "5", heading: "Waiver of rights", body: "Rights may be waived, unless the waiver is contrary to law, public order, public policy, morals, or good customs." },
      { provisionNo: "6", body: "Rights may be waived, unless the waiver is contrary to public order." },
    ],
  };
  insertStatute(db, rec);
  return db;
}

describe("toMatchExpression", () => {
  it("ANDs quoted terms and neutralizes FTS syntax", () => {
    expect(toMatchExpression('waiver "public policy" OR x')).toContain('"waiver"');
    expect(toMatchExpression("")).toBe("");
  });
});

describe("searchStatutes", () => {
  it("finds provisions above the confidence gate", () => {
    const db = seededDb();
    const config = loadConfig({ PH_COMPLIANCE_CONFIDENCE_THRESHOLD: "0.3" });
    const { results } = searchStatutes(db, { query: "waiver contrary to public policy" }, config);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]!.shortTitle).toContain("Civil Code");
    db.close();
  });

  it("respects the domain filter", () => {
    const db = seededDb();
    const config = loadConfig({ PH_COMPLIANCE_CONFIDENCE_THRESHOLD: "0.3" });
    const { results } = searchStatutes(db, { query: "waiver", domain: "tax" }, config);
    expect(results).toHaveLength(0);
    db.close();
  });

  it("returns empty rather than low-quality top-1 below threshold", () => {
    const db = seededDb();
    const config = loadConfig({ PH_COMPLIANCE_CONFIDENCE_THRESHOLD: "0.99" });
    const { results } = searchStatutes(db, { query: "waiver", domain: "civil" }, config);
    expect(results).toHaveLength(0);
    db.close();
  });

  it("reports pagination metadata (total, hasMore, nextOffset)", () => {
    const db = seededDb();
    const config = loadConfig({ PH_COMPLIANCE_CONFIDENCE_THRESHOLD: "0.2" });
    const page = searchStatutes(db, { query: "waiver", limit: 1, offset: 0 }, config);
    expect(page.total).toBe(2); // both seeded provisions match 'waiver'
    expect(page.results.length).toBe(1);
    expect(page.hasMore).toBe(true);
    expect(page.nextOffset).toBe(1);
    db.close();
  });

  it("returns empty result set with total when nothing matches", () => {
    const db = seededDb();
    const config = loadConfig({ PH_COMPLIANCE_CONFIDENCE_THRESHOLD: "0.2" });
    const page = searchStatutes(db, { query: "zzzznomatch" }, config);
    expect(page.total).toBe(0);
    expect(page.hasMore).toBe(false);
    expect(page.nextOffset).toBeNull();
    db.close();
  });
});
