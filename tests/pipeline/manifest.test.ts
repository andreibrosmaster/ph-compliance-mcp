import { describe, expect, it } from "vitest";
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { defaultStamp, writeCorpusManifest } from "../../data-pipeline/manifest.js";

describe("corpus version manifest", () => {
  it("defaults the stamp to today's date as YYYY.MM.DD", () => {
    const d = new Date(2026, 7, 2); // 2026-08-02
    expect(defaultStamp(d)).toBe("2026.08.02");
  });

  it("writes manifest.json with per-corpus sha256, counts, and sources", () => {
    const dir = mkdtempSync(join(tmpdir(), "ph-compliance-manifest-"));
    // Dummy corpus files (content matters only for the hash).
    writeFileSync(join(dir, "laws.sqlite"), "fake laws bytes");
    writeFileSync(join(dir, "cases.sqlite"), "fake cases bytes");

    writeCorpusManifest(dir, {
      stamp: "2026.08.02",
      builtAt: "2026-08-02T03:00:00.000Z",
      stats: {
        laws: { records: 12, passages: 340 },
        cases: { records: 4, passages: 88 },
        issuances: { records: 0, passages: 0 },
      },
      sources: ["official-gazette"],
      seedDir: "data-pipeline/seed",
    });

    const manifestPath = join(dir, "manifest.json");
    expect(existsSync(manifestPath)).toBe(true);
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
      schemaVersion: number;
      version: string;
      builtAt: string;
      corpora: Record<string, { file: string; sha256: string; records: number; passages: number }>;
      sources: string[];
      seedDir: string;
    };

    expect(manifest.schemaVersion).toBe(1);
    expect(manifest.version).toBe("2026.08.02");
    expect(manifest.corpora.laws).toBeDefined();
    expect(manifest.corpora.laws!.records).toBe(12);
    expect(manifest.corpora.laws!.passages).toBe(340);
    expect(manifest.corpora.laws!.sha256).toHaveLength(64);
    expect(manifest.corpora.cases!.sha256).toHaveLength(64);
    // No issuances.sqlite on disk -> not listed.
    expect(manifest.corpora.issuances).toBeUndefined();
    expect(manifest.sources).toEqual(["official-gazette"]);
    expect(manifest.seedDir).toBe("data-pipeline/seed");
  });

  it("recomputes a stable hash for identical bytes", () => {
    const dirA = mkdtempSync(join(tmpdir(), "ph-compliance-manifest-a-"));
    const dirB = mkdtempSync(join(tmpdir(), "ph-compliance-manifest-b-"));
    writeFileSync(join(dirA, "laws.sqlite"), "same bytes");
    writeFileSync(join(dirB, "laws.sqlite"), "same bytes");

    const emptyStats = { laws: { records: 0, passages: 0 } };
    writeCorpusManifest(dirA, { stamp: "s", builtAt: "t", stats: emptyStats, sources: [], seedDir: "x" });
    writeCorpusManifest(dirB, { stamp: "s", builtAt: "t", stats: emptyStats, sources: [], seedDir: "x" });

    const a = JSON.parse(readFileSync(join(dirA, "manifest.json"), "utf8")) as {
      corpora: Record<string, { sha256: string }>;
    };
    const b = JSON.parse(readFileSync(join(dirB, "manifest.json"), "utf8")) as {
      corpora: Record<string, { sha256: string }>;
    };
    expect(a.corpora.laws!.sha256).toBe(b.corpora.laws!.sha256);
  });
});
