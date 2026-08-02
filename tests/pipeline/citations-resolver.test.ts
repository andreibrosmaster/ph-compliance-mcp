import { describe, expect, it } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { insertCase, insertStatute, openCorpusDb } from "../../data-pipeline/db.js";
import { extractCitations } from "../../data-pipeline/citations/extractor.js";
import { buildGraphForSource, normalizeKey } from "../../data-pipeline/citations/resolver.js";
import { populateCitationGraph } from "../../data-pipeline/citations/populate.js";

function seededDbs() {
  const dir = mkdtempSync(join(tmpdir(), "ph-compliance-cite-"));
  const laws = openCorpusDb(join(dir, "laws.sqlite"), "laws");
  const cases = openCorpusDb(join(dir, "cases.sqlite"), "cases");

  insertStatute(laws, {
    sourceUrl: "https://example.test/cc",
    retrievedAt: "2026-08-02T00:00:00Z",
    contentHash: "aa".repeat(32),
    shortTitle: "Civil Code of the Philippines",
    officialTitle: "An Act to Ordain and Institute the Civil Code",
    kind: "code",
    actNumber: "386",
    domain: "civil",
    provisions: [
      { provisionNo: "1156", body: "An obligation is a juridical necessity to give, to do or not to do." },
    ],
  });

  insertCase(cases, {
    sourceUrl: "https://example.test/case",
    retrievedAt: "2026-08-02T00:00:00Z",
    contentHash: "bb".repeat(32),
    citation: "G.R. No. 238875",
    title: "People v. Dela Cruz",
    court: "sc",
    passages: [
      {
        passageNo: 1,
        body: "The Court cited Art. 1156, Civil Code. See also G.R. No. 238875 itself.",
      },
    ],
  });
  // A second case so case→case edges can be tested WITHOUT a self-citation
  // (the resolver's self-citation guard rejects citing the same case id).
  insertCase(cases, {
    sourceUrl: "https://example.test/case2",
    retrievedAt: "2026-08-02T00:00:00Z",
    contentHash: "cc".repeat(32),
    citation: "G.R. No. 238876",
    title: "Dela Cruz v. People",
    court: "sc",
    passages: [{ passageNo: 1, body: "Following our ruling in G.R. No. 238875." }],
  });

  return { laws, cases };
}

describe("citation resolver", () => {
  it("normalizeKey strips formatting for comparison", () => {
    expect(normalizeKey("G.R. No. 238875")).toBe("grno238875");
  });

  it("resolves statute and case spans into graph edges", () => {
    const { laws, cases } = seededDbs();
    const caseId = (cases.prepare("SELECT id FROM cases WHERE citation = 'G.R. No. 238875'").get() as { id: number }).id;
    const secondId = (cases.prepare("SELECT id FROM cases WHERE citation = 'G.R. No. 238876'").get() as { id: number }).id;
    const spans = extractCitations(
      "Art. 1156, Civil Code. See G.R. No. 238876.",
    );
    const stats = buildGraphForSource(cases, laws, { kind: "case", id: caseId }, spans);
    expect(stats.resolved).toBe(2);
    expect(stats.unresolved).toBe(0);

    const rows = cases.prepare("SELECT cited_kind, cited_statute_id, cited_case_id FROM citations_graph").all() as Array<{
      cited_kind: string;
      cited_statute_id: number | null;
      cited_case_id: number | null;
    }>;
    const statuteEdge = rows.find((r) => r.cited_kind === "statute");
    const caseEdge = rows.find((r) => r.cited_kind === "case");
    expect(statuteEdge?.cited_statute_id).toBeTruthy();
    // G.R. No. 238876 is a DIFFERENT case, so the edge must exist (a
    // self-citation to 238875 would be rejected by the guard).
    expect(caseEdge?.cited_case_id).toBe(secondId);

    laws.close();
    cases.close();
  });

  it("rejects self-citations (a case must not edge to itself)", () => {
    const { laws, cases } = seededDbs();
    const caseId = (cases.prepare("SELECT id FROM cases WHERE citation = 'G.R. No. 238875'").get() as { id: number }).id;
    const spans = extractCitations("See G.R. No. 238875, our own ruling.");
    const stats = buildGraphForSource(cases, laws, { kind: "case", id: caseId }, spans);
    expect(stats.resolved).toBe(0);
    const n = (cases.prepare("SELECT count(*) AS n FROM citations_graph").get() as { n: number }).n;
    expect(n).toBe(0);

    laws.close();
    cases.close();
  });

  it("skips unresolved citations (never guessed)", () => {
    const { laws, cases } = seededDbs();
    const caseId = (cases.prepare("SELECT id FROM cases").get() as { id: number }).id;
    const spans = extractCitations("See RA 99999 (not in corpus) and G.R. No. 777777.");
    const stats = buildGraphForSource(cases, laws, { kind: "case", id: caseId }, spans);
    expect(stats.resolved).toBe(0);
    expect(stats.unresolved).toBeGreaterThan(0);
    const n = (cases.prepare("SELECT count(*) AS n FROM citations_graph").get() as { n: number }).n;
    expect(n).toBe(0);

    laws.close();
    cases.close();
  });

  it("populateCitationGraph walks cases and statutes idempotently", () => {
    const { laws, cases } = seededDbs();
    const first = populateCitationGraph(cases, laws);
    expect(first.resolved).toBeGreaterThan(0);
    const second = populateCitationGraph(cases, laws);
    // INSERT OR IGNORE + unique index → no duplicate edges on re-runs.
    const n = (cases.prepare("SELECT count(*) AS n FROM citations_graph").get() as { n: number }).n;
    expect(n).toBeGreaterThan(0);
    expect(second.edgesInserted).toBe(0);
    // The table holds exactly the edges the first run actually inserted.
    expect(n).toBe(first.edgesInserted);

    laws.close();
    cases.close();
  });
});
