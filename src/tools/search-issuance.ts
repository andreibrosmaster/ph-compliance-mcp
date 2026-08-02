/**
 * search_issuance tool (Phase 3 — BIR first). FTS5 lexical search over
 * issuances.sqlite (Revenue Regulations, RMCs, etc.) with confidence gating.
 * Read-only + idempotent. The issuance corpus is populated starting Phase 3
 * (BIR), so this tool reports insufficient coverage until data lands.
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { Config } from "../config.js";
import type { CorpusConnection } from "../db/connect.js";
import { searchIssuances } from "../retrieval/fts-search.js";
import { textResult } from "./result.js";

const Input = z.object({
  query: z
    .string()
    .min(1, "Query must not be empty")
    .max(300, "Query must not exceed 300 characters")
    .describe("Query, e.g. 'withholding tax on dividends'"),
  agency: z
    .string()
    .optional()
    .describe("Agency code filter, e.g. 'BIR' (see issuances table)"),
  issuanceType: z
    .string()
    .optional()
    .describe("Issuance type filter, e.g. 'Revenue Memorandum Circular'"),
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

export function registerSearchIssuance(
  server: McpServer,
  conn: CorpusConnection,
  config: Config,
): void {
  server.registerTool(
    "search_issuance",
    {
      title: "Search agency issuances",
      description:
        "Lexical (FTS5/BM25) search over the administrative issuance corpus (BIR first, Phase 3). " +
        "Information retrieval, not legal advice. Below confidence threshold it reports " +
        "insufficient corpus coverage rather than guessing.\n\n" +
        "Pagination: use offset to page; check hasMore/nextOffset. Filter by agency or issuanceType.",
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
      const { results, query, total, offset, hasMore, nextOffset } = searchIssuances(
        conn.handles.issuances,
        args,
        config,
      );
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
          message: "No confident match in the issuance corpus for this query.",
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
          agency: r.agency,
          issuanceType: r.issuanceType,
          referenceNo: r.referenceNo,
          title: r.title,
          issueDate: r.issueDate,
          snippet: r.snippet,
          confidence: Number(r.confidence.toFixed(3)),
          confidenceLevel: r.confidenceLevel,
        })),
      });
    },
  );
}
