/**
 * search_statute tool. FTS5 lexical search over laws.sqlite with confidence
 * gating (blueprint §9/§10, constraint #1). Structured JSON output; below the
 * confidence threshold it returns "insufficient corpus coverage", never a
 * best-effort guess. Read-only + idempotent (mcp-builder annotations).
 *
 * NOTE: `inputSchema`/`outputSchema` must be zod *object* schemas for the MCP
 * SDK v1.30 API (outputSchema is runtime-validated against structuredContent,
 * so every branch — including "not found" — satisfies the schema).
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { Config } from "../config.js";
import type { CorpusConnection } from "../db/connect.js";
import { searchStatutes } from "../retrieval/fts-search.js";
import { textResult } from "./result.js";

const Input = z.object({
  query: z
    .string()
    .min(1, "Query must not be empty")
    .max(300, "Query must not exceed 300 characters")
    .describe("Natural-language or keyword query, e.g. 'conditions for void marriage'"),
  domain: z
    .string()
    .optional()
    .describe("Optional domain slug filter, e.g. 'civil', 'criminal', 'family' (see list_domains)"),
  limit: z.number().int().min(1).max(50).optional().describe("Max results (default 10, max 50)"),
  offset: z.number().int().min(0).optional().describe("Pagination offset (default 0)"),
});

const Output = z
  .object({
    status: z.string(),
    query: z.string(),
    count: z.number(),
    total: z.number(),
    offset: z.number(),
    hasMore: z.boolean(),
    nextOffset: z.number().nullable(),
    results: z.array(z.record(z.unknown())),
  })
  .passthrough();

export function registerSearchStatute(
  server: McpServer,
  conn: CorpusConnection,
  config: Config,
): void {
  server.registerTool(
    "search_statute",
    {
      title: "Search Philippine statutes",
      description:
        "Lexical (FTS5/BM25) search over the statute corpus (Constitution, codes, RA, PD, EO). " +
        "Information retrieval, not legal advice. Results carry structured citations; " +
        "below confidence threshold the tool reports insufficient corpus coverage rather than guessing.\n\n" +
        "Pagination: use offset to page; check hasMore/nextOffset. Use domain to narrow results.",
      inputSchema: Input,
      outputSchema: Output,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (args: z.infer<typeof Input>) => {
      const { results, query, total, offset, hasMore, nextOffset } = searchStatutes(conn.db, args, config);
      if (results.length === 0) {
        return textResult({
          status: "insufficient_corpus_coverage",
          query,
          count: 0,
          total,
          offset,
          hasMore: false,
          nextOffset: null,
          results: [],
          message: "No confident match in the statute corpus for this query. Refine your terms or widen the query.",
        });
      }
      return textResult({
        status: "ok",
        query,
        count: results.length,
        total,
        offset,
        hasMore,
        nextOffset,
        results: results.map((r) => ({
          statute: r.shortTitle,
          officialTitle: r.officialTitle,
          kind: r.kind,
          domain: r.domain,
          citation: `${r.shortTitle}, ${r.provisionNo}${r.heading ? " (" + r.heading + ")" : ""}`,
          provisionNo: r.provisionNo,
          status: r.status,
          snippet: r.snippet,
          confidence: Number(r.confidence.toFixed(3)),
          confidenceLevel: r.confidenceLevel,
        })),
      });
    },
  );
}
