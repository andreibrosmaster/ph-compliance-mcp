/**
 * search_jurisprudence tool. FTS5 lexical search over cases.sqlite with
 * confidence gating (blueprint §9/§10). Read-only + idempotent.
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { Config } from "../config.js";
import type { CorpusConnection } from "../db/connect.js";
import { searchCases } from "../retrieval/fts-search.js";
import { textResult } from "./result.js";

const Input = z.object({
  query: z
    .string()
    .min(1, "Query must not be empty")
    .max(300, "Query must not exceed 300 characters")
    .describe("Query, e.g. 'doctrine of piercing the corporate veil'"),
  court: z.enum(["sc", "ca", "sb", "cta", "other"]).optional().describe("Optional court filter"),
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

export function registerSearchJurisprudence(
  server: McpServer,
  conn: CorpusConnection,
  config: Config,
): void {
  server.registerTool(
    "search_jurisprudence",
    {
      title: "Search Philippine jurisprudence",
      description:
        "Lexical (FTS5/BM25) search over the case corpus (SC, CA, SB, CTA decisions). " +
        "Information retrieval, not legal advice. Results carry structured citations; " +
        "below confidence threshold the tool reports insufficient corpus coverage rather than guessing.\n\n" +
        "Pagination: use offset to page; check hasMore/nextOffset. Use court to narrow results.",
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
      const { results, query, total, offset, hasMore, nextOffset } = searchCases(
        conn.handles.cases,
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
          message: "No confident match in the jurisprudence corpus for this query.",
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
          citation: r.citation,
          title: r.title,
          court: r.court,
          promulgationDate: r.promulgationDate,
          ponente: r.ponente,
          snippet: r.snippet,
          confidence: Number(r.confidence.toFixed(3)),
          confidenceLevel: r.confidenceLevel,
        })),
      });
    },
  );
}
