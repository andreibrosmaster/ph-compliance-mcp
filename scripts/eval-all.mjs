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

const GOLDEN_SETS = ["evals/golden/evaluation.xml", "evals/golden/evaluation-compliance.xml"];

const pnpm = process.platform === "win32" ? "pnpm.cmd" : "pnpm";

function runSet(golden) {
  const r = spawnSync(pnpm, ["exec", "tsx", "evals/run-eval.ts", "--golden", golden], {
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
