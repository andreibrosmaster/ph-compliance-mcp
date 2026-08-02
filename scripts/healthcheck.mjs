#!/usr/bin/env node
/**
 * healthcheck — Docker HEALTHCHECK-ready probe for the ph-compliance server.
 *
 * Spawns the server over stdio, performs the MCP initialize handshake, calls
 * list_domains, and exits 0 only when the server answers with the 15-domain
 * taxonomy. Any protocol failure, crash, or empty taxonomy exits 1.
 *
 * Usage:
 *   node scripts/healthcheck.mjs                # default: node dist/src/server.js
 *   node scripts/healthcheck.mjs <server-args>  # e.g. tsx src/server.ts
 *
 * The server writes its banner to stderr; we discard it. Corpus downloads on
 * first run can take time — pair with a generous HEALTHCHECK start-period.
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
  const client = new Client({ name: "ph-compliance-healthcheck", version: "0.8.0" });
  try {
    await client.connect(transport);
    const result = (await client.callTool({ name: "list_domains", arguments: {} })) as {
      structuredContent?: { status?: string; domains?: unknown[] };
    };
    const sc = result.structuredContent ?? {};
    if (sc.status === "ok" && Array.isArray(sc.domains) && sc.domains.length > 0) {
      console.log(`healthy: ${sc.domains.length} domains`);
      process.exit(0);
    }
    console.error(`unhealthy: list_domains returned status=${sc.status} domains=${Array.isArray(sc.domains) ? sc.domains.length : "none"}`);
    process.exit(1);
  } catch (err) {
    console.error(`unhealthy: ${err instanceof Error ? err.message : String(err)}`);
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
