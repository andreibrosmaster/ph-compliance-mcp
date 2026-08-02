/**
 * list_domains tool (blueprint §9). Enumerates the 15-domain compliance
 * taxonomy (ADR-000 core + ADR-004 expansion) and reports per-domain corpus
 * freshness — the surface used by the §14 freshness eval and by the
 * check-freshness ops probe.
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { CorpusConnection } from "../db/connect.js";
import type { CorpusPaths } from "../corpus-loader.js";
import { listDomains } from "../resources/domain-index.js";
import { textResult } from "./result.js";

const Output = z
  .object({
    status: z.string(),
    count: z.number(),
    domains: z.array(z.record(z.unknown())),
  })
  .passthrough();

export function registerListDomains(
  server: McpServer,
  conn: CorpusConnection,
  paths: CorpusPaths,
): void {
  server.registerTool(
    "list_domains",
    {
      title: "List law domains and corpus freshness",
      description:
        "Enumerate the 15-domain compliance taxonomy (ADR-000 core + ADR-004 expansion) with " +
        "corpus refresh timestamps, so callers can check freshness before trusting retrieval results.",
      inputSchema: z.object({}),
      outputSchema: Output,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async () => {
      const domains = await listDomains(conn.db, paths);
      return textResult({
        status: "ok",
        count: domains.length,
        domains: domains.map((d) => ({
          slug: d.slug,
          name: d.name,
          description: d.description,
          lastRefresh: d.lastRefresh,
          keyInstruments: d.keyInstruments,
          sources: d.sources,
          refreshCadence: d.refreshCadence,
        })),
      });
    },
  );
}
