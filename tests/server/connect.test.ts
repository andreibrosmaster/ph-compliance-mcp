import { describe, expect, it } from "vitest";
import { existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { connectCorpus } from "../../src/db/connect.js";
import type { CorpusPaths } from "../../src/corpus-loader.js";

function pathsFor(dir: string): CorpusPaths {
  return {
    laws: join(dir, "laws.sqlite"),
    cases: join(dir, "cases.sqlite"),
    issuances: join(dir, "issuances.sqlite"),
  };
}

describe("connectCorpus", () => {
  it("self-initializes missing corpus files so empty corpora (ADR-003) don't crash startup", () => {
    const dir = mkdtempSync(join(tmpdir(), "ph-compliance-connect-"));
    const paths = pathsFor(dir);
    expect(existsSync(paths.issuances)).toBe(false);

    const conn = connectCorpus(paths);

    // All three files must now exist with their schemas applied.
    expect(existsSync(paths.laws)).toBe(true);
    expect(existsSync(paths.cases)).toBe(true);
    expect(existsSync(paths.issuances)).toBe(true);

    // Empty corpus is queryable (no "no such table" error).
    const domains = conn.db.prepare("SELECT count(*) AS n FROM domains").get() as { n: number };
    expect(domains.n).toBe(15);
    const cases = conn.handles.cases.prepare("SELECT count(*) AS n FROM cases").get() as { n: number };
    expect(cases.n).toBe(0);

    conn.close();
  });

  it("keeps the corpus immutable (query_only) while open", () => {
    const dir = mkdtempSync(join(tmpdir(), "ph-compliance-connect-"));
    const conn = connectCorpus(pathsFor(dir));
    expect(() => conn.db.prepare("INSERT INTO domains (slug, name) VALUES ('x', 'y')").run()).toThrow();
    conn.close();
  });
});
