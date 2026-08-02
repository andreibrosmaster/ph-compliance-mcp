/**
 * Corpus manifest helpers (0.8.0, Phase 7 version stamps).
 *
 * Side-effect-free module: importing it must never trigger the pipeline entry
 * point (build-index.ts runs main() on import — tests must not execute it).
 * The build writes manifest.json with the version stamp, build time,
 * per-corpus SHA-256 + record counts, and the sources/seed that fed the build.
 * Ops tooling (release.yml, docs/operations.md) and operators read it.
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export interface CorpusStats {
  records: number;
  passages: number;
}

export interface ManifestArgs {
  stamp: string;
  builtAt: string;
  stats: Record<string, CorpusStats>;
  sources: string[];
  seedDir: string;
}

/** Today's date as YYYY.MM.DD — the default version stamp. */
export function defaultStamp(d = new Date()): string {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}.${mm}.${dd}`;
}

function sha256File(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

/**
 * Write corpus manifest (Phase 7 version stamps + provenance). Records the
 * version stamp, build time, per-corpus SHA-256 + record counts, and the
 * sources that fed the build. Ops tools (healthcheck, freshness) and the
 * release workflow read it; `list_domains` freshness is derived from file
 * mtimes at runtime.
 */
export function writeCorpusManifest(outDir: string, args: ManifestArgs): void {
  const corpora: Record<string, { file: string; sha256: string; records: number; passages: number }> = {};
  for (const name of ["laws", "cases", "issuances"]) {
    const path = join(outDir, `${name}.sqlite`);
    if (!existsSync(path)) continue;
    corpora[name] = {
      file: `${name}.sqlite`,
      sha256: sha256File(path),
      records: args.stats[name]?.records ?? 0,
      passages: args.stats[name]?.passages ?? 0,
    };
  }
  const manifest = {
    schemaVersion: 1,
    version: args.stamp,
    builtAt: args.builtAt,
    corpora,
    sources: args.sources,
    seedDir: args.seedDir,
  };
  writeFileSync(join(outDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  console.log(`[manifest] version ${args.stamp} written to ${join(outDir, "manifest.json")}`);
}
