/**
 * Golden-coverage drift test (production gate).
 *
 * The repo ships two golden eval sets (evals/golden/*.xml) whose <plan> steps
 * must be answerable from the version-controlled seed corpus (data/seed/*.jsonl).
 * This test locks that coupling WITHOUT spawning the server: it builds an
 * in-memory corpus through the real pipeline (openCorpusDb + insertStatute/
 * insertIssuance), executes each plan step's tool call against the real search
 * functions (searchStatutes / searchIssuances / provision lookup), and asserts
 * the golden <answer> appears in the retrieved text using the exact same
 * matching helpers as the eval harness (evals/matching.ts).
 *
 * If this fails, either the seed drifted from the golden sets or a golden plan
 * no longer matches the corpus — the eval gate (pnpm eval:all) would fail too.
 */
import { describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import * as cheerio from "cheerio";
import { openCorpusDb, insertStatute, insertIssuance } from "../../data-pipeline/db.js";
import { searchStatutes, searchIssuances } from "../../src/retrieval/fts-search.js";
import { answerMatches } from "../../evals/matching.js";
import type { Config } from "../../src/config.js";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const SEED_DIR = join(ROOT, "data", "seed");
const GOLDEN_SETS = [
  join(ROOT, "evals", "golden", "evaluation.xml"),
  join(ROOT, "evals", "golden", "evaluation-compliance.xml"),
];

interface PlanStep {
  tool: string;
  args: Record<string, unknown>;
}

interface QaPair {
  question: string;
  answer: string;
  plan: PlanStep[];
}

function testConfig(dir: string): Config {
  return {
    cacheDir: dir,
    releaseUrl: `file://${dir}`,
    repo: "test/ph-compliance-mcp",
    localCorpusDir: dir,
    confidenceThreshold: 0.4,
    logLevel: "warn",
  };
}

function parseGoldenXml(xml: string): QaPair[] {
  const $ = cheerio.load(xml, { xmlMode: true });
  const pairs: QaPair[] = [];
  $("qa_pair").each((_, el) => {
    const pair = $(el);
    const question = pair.find("question").first().text().trim();
    const answer = pair.find("answer").first().text().trim();
    if (!question || !answer) return;
    const plan: PlanStep[] = [];
    pair.find("plan tool").each((_, toolEl) => {
      const t = $(toolEl);
      const name = t.attr("name");
      const argsRaw = t.attr("args");
      if (!name) return;
      let args: Record<string, unknown> = {};
      if (argsRaw) {
        try {
          args = JSON.parse(argsRaw) as Record<string, unknown>;
        } catch {
          // malformed args — leave empty so the step visibly fails
        }
      }
      plan.push({ tool: name, args });
    });
    pairs.push({ question, answer, plan });
  });
  return pairs;
}

/** Mirror of the search tool result shape — enough for the eval text contract. */
function statuteHitText(hit: {
  statuteId: number;
  shortTitle: string;
  officialTitle: string;
  kind: string;
  domain: string;
  provisionId: number;
  provisionNo: string;
  heading: string | null;
  snippet: string;
  status: string;
  confidence: number;
  confidenceLevel: string;
}): string {
  const citation = `${hit.shortTitle}, ${hit.provisionNo}${hit.heading ? ` (${hit.heading})` : ""}`;
  return JSON.stringify({ citation, provisionNo: hit.provisionNo, heading: hit.heading, snippet: hit.snippet });
}

function issuanceHitText(hit: {
  issuanceId: number;
  agency: string;
  issuanceType: string;
  referenceNo: string;
  title: string | null;
  issueDate: string | null;
  passageId: number;
  snippet: string;
  confidence: number;
  confidenceLevel: string;
}): string {
  return JSON.stringify({
    agency: hit.agency,
    issuanceType: hit.issuanceType,
    referenceNo: hit.referenceNo,
    title: hit.title,
    snippet: hit.snippet,
  });
}

/** Executes one plan step against the in-memory corpora, returning retrieved text. */
function runStep(
  step: PlanStep,
  lawsDb: ReturnType<typeof openCorpusDb>,
  issuancesDb: ReturnType<typeof openCorpusDb>,
  config: Config,
): { text: string; coverage: boolean } {
  const args = step.args;
  switch (step.tool) {
    case "search_statute": {
      const { results } = searchStatutes(
        lawsDb,
        { query: String(args.query ?? ""), domain: args.domain as string | undefined, limit: Number(args.limit ?? 5) },
        config,
      );
      if (results.length === 0) {
        return { text: "", coverage: true };
      }
      return { text: results.map((r) => statuteHitText(r)).join("\n"), coverage: false };
    }
    case "search_issuance": {
      const { results } = searchIssuances(
        issuancesDb,
        {
          query: String(args.query ?? ""),
          agency: args.agency as string | undefined,
          issuanceType: args.issuanceType as string | undefined,
          limit: Number(args.limit ?? 5),
        },
        config,
      );
      if (results.length === 0) {
        return { text: "", coverage: true };
      }
      return { text: results.map((r) => issuanceHitText(r)).join("\n"), coverage: false };
    }
    case "get_provision": {
      const provisionNo = String(args.provision ?? "").replace(/^(art\.?\s*|article\s*|sec\.?\s*|section\s*)/i, "").trim();
      const row = lawsDb
        .prepare(
          `SELECT p.provision_no, p.heading, p.body
           FROM provisions p JOIN statutes s ON s.id = p.statute_id
           WHERE lower(s.short_title) = lower(?) ORDER BY p.valid_from DESC`,
        )
        .all(String(args.statute ?? "")) as Array<{ provision_no: string; heading: string | null; body: string }>;
      const match = row.find((r) => r.provision_no.replace(/^(art\.?\s*|article\s*|sec\.?\s*|section\s*)/i, "").trim().toLowerCase() === provisionNo.toLowerCase());
      if (!match) return { text: "", coverage: true };
      return { text: JSON.stringify({ citation: `${String(args.statute)}, ${match.provision_no}`, body: match.body }), coverage: false };
    }
    case "cite_validate":
    case "list_domains":
      // Not needed to prove corpus coverage — treat as non-contributing.
      return { text: "", coverage: false };
    default:
      return { text: "", coverage: true };
  }
}

describe("golden corpus coverage (seed ↔ golden drift lock)", () => {
  for (const goldenPath of GOLDEN_SETS) {
    it(`every plan in ${goldenPath.split(/[\\/]/).pop()} retrieves its answer from data/seed`, () => {
      const dir = mkdtempSync(join(tmpdir(), "ph-compliance-golden-"));
      const lawsDb = openCorpusDb(join(dir, "laws.sqlite"), "laws");
      const issuancesDb = openCorpusDb(join(dir, "issuances.sqlite"), "issuances");
      const config = testConfig(dir);

      const seedFiles = readdirSync(SEED_DIR).filter((f) => f.endsWith(".jsonl"));
      expect(seedFiles.length).toBeGreaterThan(0);
      let statutes = 0;
      let issuances = 0;
      for (const file of seedFiles) {
        const lines = readFileSync(join(SEED_DIR, file), "utf8").split(/\r?\n/).filter(Boolean);
        for (const line of lines) {
          const entry = JSON.parse(line) as { kind: string; record: never };
          if (entry.kind === "statute") {
            insertStatute(lawsDb, entry.record);
            statutes++;
          } else if (entry.kind === "issuance") {
            insertIssuance(issuancesDb, entry.record);
            issuances++;
          }
        }
      }
      expect(statutes).toBeGreaterThan(0);
      expect(issuances).toBeGreaterThan(0);

      const xml = readFileSync(goldenPath, "utf8");
      const pairs = parseGoldenXml(xml);
      expect(pairs.length).toBeGreaterThan(0);

      const failures: string[] = [];
      for (const pair of pairs) {
        const plan = pair.plan.length > 0 ? pair.plan : [];
        const collected: string[] = [];
        let allCoverage = true;
        for (const step of plan) {
          const { text, coverage } = runStep(step, lawsDb, issuancesDb, config);
          collected.push(text);
          if (!coverage) allCoverage = false;
        }
        const haystack = collected.join("\n");
        const pass = answerMatches(haystack, pair.answer);
        if (!pass) {
          failures.push(
            `  Q: ${pair.question.slice(0, 100)}\n    answer "${pair.answer}" not found in retrieved text ` +
              `(coverage-blocked: ${allCoverage}, steps: ${plan.map((s) => s.tool).join(", ")})`,
          );
        }
      }

      try {
        expect(failures, `golden set drifted from seed corpus:\n${failures.join("\n")}`).toEqual([]);
      } finally {
        // Close even when the assertion throws, so a red gate cannot hang the
        // vitest process on open better-sqlite3 handles.
        lawsDb.close();
        issuancesDb.close();
      }
    });
  }
});
