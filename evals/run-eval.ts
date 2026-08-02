/**
 * run-eval — the Phase 5 golden-set harness (blueprint §14, roadmap "Eval
 * matrix"). Spawns the real ph-compliance MCP server over stdio via the MCP
 * SDK Client, executes each golden QA pair's retrieval plan against it, and
 * scores the answer by string match against the retrieved text.
 *
 * A pair passes when the normalized answer appears in the text returned by
 * the plan's tool calls (search → get_provision / get_issuance / get_case).
 * Pairs that cannot be answered because the corpus has no matching data
 * report `coverage` (not counted as regressions) and the run exits 2 so CI
 * can tell "no data yet" apart from "real regression".
 *
 * Usage:
 *   pnpm eval                                   # default golden set + dist server
 *   pnpm eval -- --server "node dist/src/server.js" --golden evals/golden/evaluation-compliance.xml
 *   pnpm eval -- --skip-coverage-exit           # exit 0 even if corpus is empty
 */
import { readFile } from "node:fs/promises";
import * as cheerio from "cheerio";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

interface PlanStep {
  tool: string;
  args: Record<string, unknown>;
}

interface QaPair {
  question: string;
  answer: string;
  plan: PlanStep[];
}

interface CliArgs {
  serverCommand: string;
  serverArgs: string[];
  golden: string;
  skipCoverageExit: boolean;
  verbose: boolean;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    serverCommand: "node",
    serverArgs: ["dist/src/server.js"],
    golden: "evals/golden/evaluation.xml",
    skipCoverageExit: false,
    verbose: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    const value = argv[i + 1];
    if (flag === "--server" && value) {
      const parts = value.split(" ");
      args.serverCommand = parts[0]!;
      args.serverArgs = parts.slice(1);
      i++;
    } else if (flag === "--golden" && value) {
      args.golden = value;
      i++;
    } else if (flag === "--skip-coverage-exit") {
      args.skipCoverageExit = true;
    } else if (flag === "--verbose") {
      args.verbose = true;
    }
  }
  return args;
}

import { answerMatches, collectText, normalize } from "./matching.js";

export { answerMatches, normalize };

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
      const tool = $(toolEl);
      const name = tool.attr("name");
      const argsRaw = tool.attr("args");
      if (!name) return;
      let args: Record<string, unknown> = {};
      if (argsRaw) {
        try {
          args = JSON.parse(argsRaw) as Record<string, unknown>;
        } catch {
          console.error(`  [eval] malformed args on tool ${name}: ${argsRaw}`);
        }
      }
      plan.push({ tool: name, args });
    });
    pairs.push({ question, answer, plan });
  });
  return pairs;
}

/** Default plan when a pair has none: search the question across corpora. */
function defaultPlan(question: string): PlanStep[] {
  const q = question.length > 280 ? question.slice(0, 280) : question;
  return [
    { tool: "search_statute", args: { query: q, limit: 5 } },
    { tool: "search_jurisprudence", args: { query: q, limit: 5 } },
    { tool: "search_issuance", args: { query: q, limit: 5 } },
  ];
}

interface PairResult {
  question: string;
  answer: string;
  pass: boolean;
  coverage: boolean;
  detail: string;
}

async function runPair(
  client: Client,
  pair: QaPair,
  verbose: boolean,
): Promise<PairResult> {
  const plan = pair.plan.length > 0 ? pair.plan : defaultPlan(pair.question);
  const collected: string[] = [];
  let sawCoverage = false;

  for (const step of plan) {
    let result;
    try {
      result = (await client.callTool({ name: step.tool, arguments: step.args })) as {
        content?: Array<{ type: string; text?: string }>;
        structuredContent?: { status?: string };
      };
    } catch (err) {
      return {
        question: pair.question,
        answer: pair.answer,
        pass: false,
        coverage: false,
        detail: `tool ${step.tool} failed: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
    const status = result.structuredContent?.status ?? "";
    if (status === "insufficient_corpus_coverage" || status === "cannot_validate") {
      sawCoverage = true;
    }
    const text = collectText(result);
    collected.push(text);
    if (verbose) {
      console.log(`    → ${step.tool}(${JSON.stringify(step.args).slice(0, 120)}): ${text.slice(0, 120).replace(/\n/g, " ")}`);
    }
  }

  const haystack = collected.join("\n");
  const pass = answerMatches(haystack, pair.answer);
  // A pair is "coverage-blocked" when nothing matched at all (empty corpus).
  const coverage = sawCoverage || normalize(haystack).length === 0;
  return {
    question: pair.question,
    answer: pair.answer,
    pass,
    coverage: !pass && coverage,
    detail: pass ? "answer found in retrieved text" : `answer "${pair.answer}" not found in retrieved text`,
  };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  // The SDK's StdioClientTransport on Windows inherits only a safe whitelist of
  // env vars (getDefaultEnvironment) — PH_COMPLIANCE_* would be dropped and the
  // spawned server would ignore PH_COMPLIANCE_LOCAL_CORPUS, try to download the
  // corpus from GitHub Releases (404), crash, and the client would see
  // "Connection closed". Forward them explicitly so eval:all's local-corpus
  // wiring actually reaches the server under test.
  const transport = new StdioClientTransport({
    command: args.serverCommand,
    args: args.serverArgs,
    stderr: "pipe",
    env: Object.fromEntries(
      Object.entries(process.env).filter(([key]) => key.startsWith("PH_COMPLIANCE_")),
    ),
  });
  const client = new Client({ name: "ph-compliance-eval-harness", version: "0.10.0" });

  let pairs: QaPair[];
  try {
    const xml = await readGolden(args.golden);
    pairs = parseGoldenXml(xml);
  } catch (err) {
    console.error(`[eval] cannot read golden set ${args.golden}: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(2);
  }

  console.log(`[eval] golden set: ${args.golden} (${pairs.length} pairs)`);
  console.log(`[eval] server: ${args.serverCommand} ${args.serverArgs.join(" ")}`);

  let started = false;
  try {
    await client.connect(transport);
    started = true;
  } catch (err) {
    console.error(`[eval] failed to start server: ${err instanceof Error ? err.message : String(err)}`);
    console.error(`[eval] build the server first (pnpm build) and/or populate the corpus (pnpm build:corpus).`);
    process.exit(2);
  }

  const results: PairResult[] = [];
  let index = 0;
  for (const pair of pairs) {
    index++;
    const res = await runPair(client, pair, args.verbose);
    results.push(res);
    const mark = res.pass ? "PASS" : res.coverage ? "COVER" : "FAIL";
    console.log(`  [${index}/${pairs.length}] ${mark}: ${pair.question.slice(0, 110)}`);
    if (!res.pass) console.log(`         ${res.detail}`);
  }

  await client.close();

  const passed = results.filter((r) => r.pass).length;
  const coverage = results.filter((r) => r.coverage).length;
  const failed = results.filter((r) => !r.pass && !r.coverage).length;

  console.log(`\n[eval] summary: ${passed} passed, ${coverage} coverage-blocked (corpus), ${failed} failed`);

  if (!started) process.exit(2);
  if (failed > 0) process.exit(1);
  // Exit 2 when the corpus is too empty to answer anything (distinguish from
  // a real regression), unless the caller opted out.
  if (coverage > 0 && passed === 0 && !args.skipCoverageExit) {
    console.error("[eval] note: no pair passed — corpus may be unpopulated. Run pnpm build:corpus with seed data.");
    process.exit(2);
  }
}

async function readGolden(path: string): Promise<string> {
  return readFile(path, "utf8");
}

main().catch((err) => {
  console.error(`[eval] fatal: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(2);
});
