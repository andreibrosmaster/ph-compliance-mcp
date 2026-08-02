/**
 * build-index — pipeline entry point (blueprint §5 Layer 1, §13 Phase 1).
 *
 * Reads ingestion sources (local JSONL seed files and/or live source adapters),
 * normalizes into records, and writes laws.sqlite + cases.sqlite + issuances.sqlite
 * under --out. Embeddings are stubbed (ADR-002). CI-only; never runs at runtime.
 *
 * Phase 4: after building laws + cases, populates citations_graph by extracting
 * citations from every case/statute text and resolving them against the corpus.
 *
 * Usage:
 *   pnpm build:corpus -- --seed data/seed --out dist/corpus [--corpus laws,cases] [--sources official-gazette,lawphil] [--stamp 2026.08.02]
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { defaultStamp, writeCorpusManifest } from "./manifest.js";
import { HttpClient } from "./http-client.js";
import { openCorpusDb, insertCase, insertIssuance, insertStatute } from "./db.js";
import { populateCitationGraph } from "./citations/populate.js";
import { embedText, EMBEDDINGS_ACTIVE } from "./embedding.js";
import { INSTRUMENT_CATALOG } from "./catalog.js";
import { adapterById, type SourceAdapter } from "./sources/types.js";
import { normalizeStatute } from "./normalizers/statute-normalizer.js";
import { mapCatalogKind } from "./sources/targets.js";
import type { CaseRecord, IssuanceRecord, StatuteRecord } from "./types.js";

interface SeedLine {
  kind: "statute" | "case" | "issuance";
  record: StatuteRecord | CaseRecord | IssuanceRecord;
}

interface CliArgs {
  seed: string;
  out: string;
  corpus: string;
  citations: boolean;
  sources: string[];
  maxPerSource?: number;
  since?: string;
  /** Version stamp (defaults to today's date YYYY.MM.DD) — Phase 7 per-file stamps. */
  stamp?: string;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = { seed: "data/seed", out: "dist/corpus", corpus: "laws,cases,issuances", citations: true, sources: [] };
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    const value = argv[i + 1];
    if (flag === "--seed" && value) {
      args.seed = value;
      i++;
    } else if (flag === "--out" && value) {
      args.out = value;
      i++;
    } else if (flag === "--corpus" && value) {
      args.corpus = value;
      i++;
    } else if (flag === "--sources" && value) {
      args.sources = value.split(",").map((s) => s.trim()).filter(Boolean);
      i++;
    } else if (flag === "--max" && value) {
      args.maxPerSource = Number(value);
      i++;
    } else if (flag === "--since" && value) {
      args.since = value;
      i++;
    } else if (flag === "--stamp" && value) {
      args.stamp = value;
      i++;
    } else if (flag === "--no-citations") {
      args.citations = false;
    }
  }
  return args;
}



/** Read all *.jsonl files in the seed dir as ingestion records. */
function loadSeedRecords(seedDir: string): SeedLine[] {
  let files: string[] = [];
  try {
    files = readdirSync(seedDir).filter((f) => f.endsWith(".jsonl"));
  } catch {
    console.warn(`seed dir not found: ${seedDir} — nothing to ingest`);
    return [];
  }
  const lines: SeedLine[] = [];
  for (const file of files) {
    const raw = readFileSync(join(seedDir, file), "utf8");
    for (const line of raw.split(/\r?\n/)) {
      if (!line.trim()) continue;
      const parsed = JSON.parse(line) as SeedLine;
      if (parsed.kind && parsed.record) lines.push(parsed);
    }
  }
  return lines;
}

/**
 * Run source adapters and ingest their statute documents into laws.sqlite.
 * Adapters yield RawDocuments whose sourceUrl matches a catalog entry; the
 * entry supplies the normalization metadata (title, kind, domain). This is
 * the live-ingestion path — CI-only, polite-HTTP, never at runtime.
 */
async function ingestFromSources(
  adapters: SourceAdapter[],
  outDir: string,
  opts: { max?: number; since?: string },
): Promise<number> {
  const db = openCorpusDb(join(outDir, "laws.sqlite"), "laws");
  const cacheDir = join(outDir, ".http-cache");
  const client = new HttpClient({
    userAgent: "ph-compliance-mcp/0.10.0 (corpus build; contact: repo issues)",
    cacheDir,
    minDelayMs: 1000,
    maxConcurrency: 1,
  });
  let total = 0;
  try {
    for (const adapter of adapters) {
      let fromAdapter = 0;
      for await (const doc of adapter.fetch(client, { max: opts.max, since: opts.since })) {
        const entry = INSTRUMENT_CATALOG.find((e) => e.sourceUrl === doc.sourceUrl);
        if (!entry) {
          console.warn(`[${adapter.id}] no catalog entry for ${doc.sourceUrl} — skipping`);
          continue;
        }
        // Idempotency guard: re-running --sources over an existing laws.sqlite
        // must not duplicate a statute already ingested from the same source.
        // (Guard is scoped to the sources path; seed records share their own
        // sourceUrl, so a seed + sources overlap is not expected.)
        const existing = db
          .prepare("SELECT id FROM statutes WHERE short_title = ? AND source_url = ? LIMIT 1")
          .get(entry.shortTitle, doc.sourceUrl) as { id: number } | undefined;
        if (existing) {
          console.log(`  [${adapter.id}] ${entry.shortTitle} already ingested (#${existing.id}) — skipping`);
          continue;
        }
        const rec = normalizeStatute(doc, {
          shortTitle: entry.shortTitle,
          officialTitle: entry.officialTitle ?? entry.shortTitle,
          kind: mapCatalogKind(entry.kind),
          domain: entry.domain,
          enactedDate: entry.enactedDate,
        });
        const id = insertStatute(db, rec);
        fromAdapter++;
        total++;
        console.log(`  [${adapter.id}] ${entry.shortTitle} -> statute #${id} (${rec.provisions.length} provisions)`);
      }
      console.log(`[${adapter.id}] ${fromAdapter} instruments ingested`);
    }
  } finally {
    db.close();
  }
  return total;
}

async function buildCorpus(
  corpus: string,
  records: SeedLine[],
  outDir: string,
): Promise<{ records: number; passages: number }> {
  const db = openCorpusDb(join(outDir, `${corpus}.sqlite`), corpus as "laws" | "cases" | "issuances");
  let passages = 0;

  const filtered = records.filter((r) => {
    if (corpus === "laws") return r.kind === "statute";
    if (corpus === "cases") return r.kind === "case";
    return r.kind === "issuance";
  });

  if (corpus === "laws") {
    for (const line of filtered) {
      const rec = line.record as StatuteRecord;
      const id = insertStatute(db, rec);
      passages += rec.provisions.length;
      await embedText(rec.officialTitle); // no-op stub until Phase 4/5
      console.log(`  [laws] ${rec.shortTitle} -> statute #${id} (${rec.provisions.length} provisions)`);
    }
  } else if (corpus === "cases") {
    const tx = db.transaction((lines: SeedLine[]) => {
      for (const line of lines) {
        const rec = line.record as CaseRecord;
        const caseId = insertCase(db, rec);
        passages += rec.passages.length;
        console.log(`  [cases] ${rec.citation} -> case #${caseId} (${rec.passages.length} passages)`);
      }
    });
    tx(filtered);
  } else if (corpus === "issuances") {
    const tx = db.transaction((lines: SeedLine[]) => {
      for (const line of lines) {
        const rec = line.record as IssuanceRecord;
        const issuanceId = insertIssuance(db, rec);
        passages += rec.passages.length;
        console.log(`  [issuances] ${rec.agency} ${rec.referenceNo} -> #${issuanceId}`);
      }
    });
    tx(filtered);
  }

  db.close();
  return { records: filtered.length, passages };
}

async function main(): Promise<void> {
  const { seed, out, corpus, citations, sources, maxPerSource, since, stamp } = parseArgs(process.argv.slice(2));
  const versionStamp = stamp ?? defaultStamp();
  mkdirSync(out, { recursive: true });

  // Deterministic rebuilds: the seed-driven build is not incremental. Stale
  // sqlite files from a previous run would make re-running hit UNIQUE()
  // constraints (cases.citation, issuance passages, etc.), so remove the
  // targets before writing. The corpus is a derived artifact (ADR-003).
  for (const name of corpus.split(",").map((s) => s.trim())) {
    if (!["laws", "cases", "issuances"].includes(name)) continue;
    for (const suffix of ["", "-wal", "-shm"]) {
      rmSync(join(out, `${name}.sqlite${suffix}`), { force: true });
    }
  }

  // Live source adapters first (they populate laws.sqlite), then local seed files.
  let ingestedFromSources = 0;
  if (sources.length > 0) {
    const adapters = sources.map((id) => adapterById(id)).filter((a): a is SourceAdapter => Boolean(a));
    const missing = sources.filter((id) => !adapterById(id));
    if (missing.length > 0) {
      console.error(`unknown source adapter(s): ${missing.join(", ")}`);
      process.exitCode = 1;
    }
    if (adapters.length > 0) {
      ingestedFromSources = await ingestFromSources(adapters, out, { max: maxPerSource, since });
      console.log(`Ingested ${ingestedFromSources} instruments from ${adapters.length} source adapter(s)`);
    }
  }

  const records = loadSeedRecords(seed);
  console.log(`Loaded ${records.length} seed records`);

  const stats: Record<string, { records: number; passages: number }> = {};
  for (const corpusName of corpus.split(",").map((s) => s.trim())) {
    stats[corpusName] = await buildCorpus(corpusName, records, out);
    console.log(`[${corpusName}] ${stats[corpusName]!.records} records, ${stats[corpusName]!.passages} passages/provisions indexed`);
  }

  // Phase 4: populate the citation graph once laws + cases both exist.
  const lawsPath = join(out, "laws.sqlite");
  const casesPath = join(out, "cases.sqlite");
  if (citations && existsSync(lawsPath) && existsSync(casesPath)) {
    const lawsDb = openCorpusDb(lawsPath, "laws");
    const casesDb = openCorpusDb(casesPath, "cases");
    try {
      const stats = populateCitationGraph(casesDb, lawsDb);
      console.log(
        `[citations] ${stats.cases} cases, ${stats.statuteEdges} statute edges; ` +
          `${stats.spans} spans, ${stats.resolved} resolved, ${stats.unresolved} unresolved`,
      );
    } finally {
      lawsDb.close();
      casesDb.close();
    }
  } else if (citations) {
    console.warn("[citations] skipped: laws.sqlite + cases.sqlite both required");
  }

  console.log(`embeddings active: ${EMBEDDINGS_ACTIVE} (stub until Phase 4/5, ADR-002)`);

  // Phase 7: version-stamped manifest for ops/release tooling.
  writeCorpusManifest(out, {
    stamp: versionStamp,
    builtAt: new Date().toISOString(),
    stats,
    sources,
    seedDir: seed,
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
