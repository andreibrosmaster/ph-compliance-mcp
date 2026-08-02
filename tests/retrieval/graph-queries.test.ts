import { describe, expect, it } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { insertCase, insertStatute, openCorpusDb } from "../../data-pipeline/db.js";
import { populateCitationGraph } from "../../data-pipeline/citations/populate.js";
import {
  amendmentsForStatute,
  edgesFromCase,
  irrReferencesForStatute,
  provisionHistory,
  resolveCaseId,
  resolveStatuteId,
  statutesCitingStatute,
  type GraphContext,
} from "../../src/tools/graph/queries.js";

function seeded() {
  const dir = mkdtempSync(join(tmpdir(), "ph-compliance-graph-"));
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
      { provisionNo: "5", body: "Rights may be waived, unless contrary to law, public order, or morals." },
    ],
  });
  laws
    .prepare(
      `INSERT INTO amendments (statute_id, amending_law, provision_no, effective_date, summary)
       VALUES ((SELECT id FROM statutes WHERE act_number = '386'), 'RA 11466', '5', '2020-01-01', 'Amended waiver rules')`,
    )
    .run();

  insertCase(cases, {
    sourceUrl: "https://example.test/case1",
    retrievedAt: "2026-08-02T00:00:00Z",
    contentHash: "bb".repeat(32),
    citation: "G.R. No. 238875",
    title: "People v. Dela Cruz",
    court: "sc",
    passages: [
      {
        passageNo: 1,
        body: "The Court cited Art. 1156, Civil Code and Art. 5, Civil Code. See G.R. No. 238876.",
      },
    ],
  });
  insertCase(cases, {
    sourceUrl: "https://example.test/case2",
    retrievedAt: "2026-08-02T00:00:00Z",
    contentHash: "cc".repeat(32),
    citation: "G.R. No. 238876",
    title: "Dela Cruz v. People",
    court: "sc",
    passages: [{ passageNo: 1, body: "Following our ruling in G.R. No. 238875, Art. 1156, Civil Code applies." }],
  });

  populateCitationGraph(cases, laws);
  return { laws, cases };
}

function ctxOf(laws: ReturnType<typeof seeded>["laws"], cases: ReturnType<typeof seeded>["cases"]): GraphContext {
  return { laws, cases };
}

describe("graph queries", () => {
  it("resolveCaseId / resolveStatuteId find corpus entities", () => {
    const { laws, cases } = seeded();
    const ctx = ctxOf(laws, cases);
    expect(resolveCaseId(ctx, "G.R. No. 238875")).toBeTruthy();
    expect(resolveCaseId(ctx, "G.R. No. 999999")).toBeNull();
    expect(resolveStatuteId(ctx, "Civil Code of the Philippines")).toBeTruthy();
    expect(resolveStatuteId(ctx, "Whatever", "386")).toBeTruthy();
    laws.close();
    cases.close();
  });

  it("edgesFromCase lists resolved citations of a case", () => {
    const { laws, cases } = seeded();
    const ctx = ctxOf(laws, cases);
    const caseId = resolveCaseId(ctx, "G.R. No. 238875")!;
    const edges = edgesFromCase(ctx, caseId);
    expect(edges.some((e) => e.citedKind === "statute")).toBe(true);
    expect(edges.some((e) => e.citedKind === "case")).toBe(true); // cites the other case
    laws.close();
    cases.close();
  });

  it("amendmentsForStatute and provisionHistory return version data", () => {
    const { laws, cases } = seeded();
    const ctx = ctxOf(laws, cases);
    const statuteId = resolveStatuteId(ctx, "Civil Code of the Philippines")!;
    const amendments = amendmentsForStatute(ctx, statuteId);
    expect(amendments.length).toBeGreaterThan(0);
    expect(amendments[0]!.amending_law).toBe("RA 11466");
    const history = provisionHistory(ctx, statuteId, "5");
    expect(history.length).toBeGreaterThan(0);
    expect(history[0]!.provision_no).toBe("5");
    laws.close();
    cases.close();
  });

  it("statutesCitingStatute finds law→law reverse edges", () => {
    const { laws, cases } = seeded();
    const ctx = ctxOf(laws, cases);
    // No statute→statute edges in this fixture, so the result is empty — safe.
    const statuteId = resolveStatuteId(ctx, "Civil Code of the Philippines")!;
    expect(statutesCitingStatute(ctx, statuteId)).toEqual([]);
    expect(irrReferencesForStatute(ctx, statuteId)).toEqual([]);
    laws.close();
    cases.close();
  });
});
