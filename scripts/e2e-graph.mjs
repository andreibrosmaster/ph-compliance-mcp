#!/usr/bin/env node
/**
 * e2e-graph — exercises the Phase 4 graph tools end-to-end against the built
 * corpus: spawns the real server over stdio (the same path an agent uses),
 * performs the MCP handshake, and calls graph/retrieval tools.
 *
 * Usage: node scripts/e2e-graph.mjs [corpusDir]
 * Exit 0 = all assertions passed; 1 = failure (details on stdout).
 */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const corpusDir = resolve(ROOT, process.argv[2] ?? "dist/corpus");

const results = [];
let failed = 0;

function check(name, cond, detail) {
  const ok = Boolean(cond);
  if (!ok) failed++;
  results.push(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

// Spawn the built server exactly as an agent would (dist build over stdio).
const transport = new StdioClientTransport({
  command: process.execPath,
  args: [resolve(ROOT, "dist/src/server.js")],
  env: { ...process.env, PH_COMPLIANCE_LOCAL_CORPUS: corpusDir, PH_COMPLIANCE_LOG_LEVEL: "warn" },
});

const client = new Client({ name: "ph-compliance-e2e-graph", version: "0.12.0" });
await client.connect(transport);

try {
  // 1. related_laws on Molina — expects the Family Code edge.
  const molina = await client.callTool({ name: "related_laws", arguments: { caseCitation: "G.R. No. 108763" } });
  const molinaLaws = molina.structuredContent?.laws ?? [];
  check(
    "related_laws Molina -> Family Code",
    molina.structuredContent?.status === "ok" &&
      molinaLaws.some((l) => l.shortTitle === "Family Code of the Philippines"),
    JSON.stringify(molinaLaws.map((l) => l.shortTitle)),
  );

  // 2. related_laws on Naguiat — expects Labor Code + Civil Code edges.
  const naguiat = await client.callTool({ name: "related_laws", arguments: { caseCitation: "G.R. No. 116123" } });
  const naguiatLaws = naguiat.structuredContent?.laws ?? [];
  check(
    "related_laws Naguiat -> Labor Code + Civil Code",
    naguiatLaws.some((l) => l.shortTitle === "Labor Code of the Philippines") &&
      naguiatLaws.some((l) => l.shortTitle === "Civil Code of the Philippines"),
    JSON.stringify(naguiatLaws.map((l) => l.shortTitle)),
  );

  // 3. get_case returns the verified Oposa record (metadata + passages).
  const oposa = await client.callTool({ name: "get_case", arguments: { citation: "G.R. No. 101083" } });
  check(
    "get_case Oposa resolves with passages",
    oposa.structuredContent?.status === "ok" &&
      /oposa/i.test(String(oposa.structuredContent?.title)) &&
      (oposa.structuredContent?.passages?.length ?? 0) > 0,
    `title=${oposa.structuredContent?.title}`,
  );

  // 4. search_jurisprudence retrieves the new decisions by doctrine.
  const search = await client.callTool({
    name: "search_jurisprudence",
    arguments: { query: "psychological incapacity gravity juridical antecedence incurability" },
  });
  check(
    "search_jurisprudence finds the Molina doctrine",
    (search.structuredContent?.results ?? []).some((h) => /molina/i.test(JSON.stringify(h))),
    `hits=${search.structuredContent?.count}`,
  );

  // 5. Honesty path: a case whose citations don't resolve reports count 0.
  const tibay = await client.callTool({ name: "related_laws", arguments: { caseCitation: "G.R. No. 46496" } });
  check(
    "related_laws Ang Tibay honestly reports 0 resolved statutes",
    tibay.structuredContent?.status === "ok" && tibay.structuredContent?.count === 0,
    `count=${tibay.structuredContent?.count}`,
  );

  // 6. Unknown citation -> insufficient_corpus_coverage (never a guess).
  const unknown = await client.callTool({ name: "related_laws", arguments: { caseCitation: "G.R. No. 999999" } });
  check(
    "related_laws unknown citation -> insufficient_corpus_coverage",
    unknown.structuredContent?.status === "insufficient_corpus_coverage",
    `status=${unknown.structuredContent?.status}`,
  );
} finally {
  await client.close().catch(() => {});
}

console.log(results.join("\n"));
if (failed > 0) {
  process.exit(1);
}
console.log("\ne2e-graph: all assertions passed");
