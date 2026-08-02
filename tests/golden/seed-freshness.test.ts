/**
 * Seed-freshness drift lock (production gate, closes the stale-seed loop).
 *
 * The golden drift test (dataset-coverage.test.ts) validates seed↔golden
 * coupling but reads data/seed from disk — it cannot catch the failure mode
 * where generate-seed.mjs is edited without being re-run, leaving data/seed
 * stale. This test regenerates the seed into a temp dir and asserts the output
 * is byte-identical to the committed data/seed/*.jsonl.
 *
 * If this fails: run `pnpm seed` (node scripts/generate-seed.mjs), then
 * `pnpm build:corpus`, and commit the regenerated files.
 */
import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const SEED_DIR = join(ROOT, "data", "seed");
const GENERATOR = join(ROOT, "scripts", "generate-seed.mjs");

describe("seed freshness (generate-seed.mjs ↔ data/seed)", () => {
  it("regenerating the seed produces byte-identical JSONL files", () => {
    const outDir = mkdtempSync(join(tmpdir(), "ph-compliance-seed-"));
    execFileSync(process.execPath, [GENERATOR, "--out", outDir], { stdio: "pipe" });

    const committed = readdirSync(SEED_DIR).filter((f) => f.endsWith(".jsonl")).sort();
    const regenerated = readdirSync(outDir).filter((f) => f.endsWith(".jsonl")).sort();

    expect(regenerated).toEqual(committed);
    for (const file of committed) {
      const committedText = readFileSync(join(SEED_DIR, file), "utf8");
      const regeneratedText = readFileSync(join(outDir, file), "utf8");
      expect(regeneratedText, `data/seed/${file} is stale — run \`pnpm seed\` and rebuild`).toBe(committedText);
    }
  });
});
