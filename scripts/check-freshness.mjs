#!/usr/bin/env node
/**
 * check-freshness — report per-domain corpus freshness (operations runbook:
 * freshness SLAs). Spawns the server, calls list_domains, and prints each
 * domain with its lastRefresh timestamp (list_domains reports freshness
 * per-domain, derived from the cached corpus asset mtimes). Exits 0 normally,
 * 1 if the server cannot answer (e.g. corpus missing).
 *
 * Usage:
 *   node scripts/check-freshness.mjs
 *   node scripts/check-freshness.mjs tsx src/server.ts
 *
 * Freshness reflects when the corpus was built/downloaded — not when the law
 * changed. See docs/operations.md for the refresh cadence.
 */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const SERVER_ARGS = process.argv.slice(2).length > 0 ? process.argv.slice(2) : ["dist/src/server.js"];

async function main() {
  const transport = new StdioClientTransport({
    command: "node",
    args: SERVER_ARGS,
    stderr: "ignore",
  });
  const client = new Client({ name: "ph-compliance-freshness", version: "0.8.0" });
  try {
    await client.connect(transport);
    const result = (await client.callTool({ name: "list_domains", arguments: {} })) as {
      structuredContent?: {
        status?: string;
        domains?: Array<{ slug?: string; name?: string; lastRefresh?: string | null }>;
      };
    };
    const sc = result.structuredContent ?? {};
    const domains = Array.isArray(sc.domains) ? sc.domains : [];

    console.log(`list_domains status: ${sc.status ?? "unknown"} (${domains.length} domains)`);
    console.log("last refreshed per domain (from corpus mtimes):");
    for (const d of domains) {
      console.log(`  ${String(d.slug ?? "?").padEnd(22)} ${d.lastRefresh ?? "never/unknown"}`);
    }
    if (sc.status !== "ok" || domains.length === 0) {
      console.error("freshness check failed: server did not report domains (corpus missing?)");
      process.exit(1);
    }
  } catch (err) {
    console.error(`freshness check failed: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  } finally {
    try {
      await client.close();
    } catch {
      // transport may already be gone
    }
  }
}

main();
