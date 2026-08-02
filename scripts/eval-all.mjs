#!/usr/bin/env node
/**
 * eval-all — run BOTH golden sets and aggregate, without the `&&` short-circuit
 * of the old pnpm script (a coverage-blocked core set must not skip the
 * compliance set).
 *
 * Exit codes (same contract as evals/run-eval.ts, aggregated):
 *   0 — every set passed (a set with some coverage-blocked pairs but at least
 *       one pass returns 0 from run-eval; any pass anywhere → overall 0)
 *   1 — at least one set has a real regression (failed > 0) — release-blocking
 *   2 — every set is coverage-blocked (corpus unpopulated) — non-blocking
 *
 * Usage: node scripts/eval-all.mjs
 */
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";

const GOLDEN_SETS = ["evals/golden/evaluation.xml", "evals/golden/evaluation-compliance.xml"];

const require = createRequire(import.meta.url);
/**
 * The tsx CLI entry (dist/cli.mjs) resolved from the installed package — the
 * child is spawned with process.execPath so no .cmd shim or shell is needed.
 * On Windows, spawnSync cannot execute pnpm.cmd without a shell (EINVAL) and
 * shell:true triggers DEP0190 (unescaped arg concatenation), so spawning the
 * CLI directly via node avoids both.
 */
const TSX_CLI = join(require.resolve("tsx/package.json"), "..", "dist", "cli.mjs");

/**
 * Point the spawned server at a locally built corpus (dist/corpus) when one
 * exists, and emit the .sha256 sidecars the corpus-loader verifies — mirroring
 * what release.yml publishes per Release asset.
 */
function wireLocalCorpus() {
  const corpusDir = join(process.cwd(), "dist", "corpus");
  const assets = ["laws", "cases", "issuances"];
  const present = assets.filter((name) => existsSync(join(corpusDir, `${name}.sqlite`)));
  if (present.length === 0) {
    console.log("[eval-all] no local corpus in dist/corpus — server will report coverage-blocked pairs.");
    return;
  }
  for (const name of present) {
    const dbPath = join(corpusDir, `${name}.sqlite`);
    const sumPath = `${dbPath}.sha256`;
    const hex = createHash("sha256").update(readFileSync(dbPath)).digest("hex");
    writeFileSync(sumPath, `${hex}  ${name}.sqlite\n`);
  }
  process.env.PH_COMPLIANCE_LOCAL_CORPUS = corpusDir;
  console.log(`[eval-all] using local corpus: ${corpusDir} (${present.join(", ")})`);
}

wireLocalCorpus();

function runSet(golden) {
  const r = spawnSync(process.execPath, [TSX_CLI, "evals/run-eval.ts", "--golden", golden], {
    stdio: "inherit",
  });
  return r.status ?? 1;
}

let anyRegression = false;
let anyPassed = false;
for (const golden of GOLDEN_SETS) {
  const code = runSet(golden);
  if (code === 1) anyRegression = true;
  if (code === 0) anyPassed = true;
  console.log(`[eval-all] ${golden} -> exit ${code}`);
}

if (anyRegression) {
  console.error("[eval-all] regression detected in a golden set — release-blocking");
  process.exit(1);
}
if (!anyPassed) {
  console.error("[eval-all] no golden set passed — corpus likely unpopulated (coverage-blocked)");
  process.exit(2);
}
console.log("[eval-all] all golden sets passed");
