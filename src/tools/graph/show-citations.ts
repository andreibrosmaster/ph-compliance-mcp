/**
 * show_citations tool (Phase 4). Given a case, list every citation it makes
 * (statutes and cases) as recorded in citations_graph, with resolved titles.
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { CorpusConnection } from "../../db/connect.js";
import { textResult } from "../result.js";
import { caseById, edgesFromCase, resolveCaseId, statuteById, type GraphContext } from "./queries.js";

const Input = z.object({
  caseCitation: z.string().min(1).describe("Case citation, e.g. 'G.R. No. 238875'"),
  limit: z.number().int().min(1).max(200).optional().describe("Max results (default 100, max 200)"),
});

const Output = z
  .object({
    status: z.string(),
    caseCitation: z.string().nullable(),
    count: z.number(),
    citations: z.array(z.record(z.unknown())),
  })
  .passthrough();

export function registerShowCitations(server: McpServer, conn: CorpusConnection): void {
  server.registerTool(
    "show_citations",
    {
      title: "Citations made by a case",
      description:
        "List every citation a case makes (statutes and other cases), as recorded in the citation graph. " +
        "Citations that could not be resolved against the corpus are not listed.",
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
      const ctx: GraphContext = { laws: conn.db, cases: conn.handles.cases };
      const caseId = resolveCaseId(ctx, args.caseCitation);
      if (caseId === null) {
        return textResult({
          status: "insufficient_corpus_coverage",
          caseCitation: null,
          count: 0,
          citations: [],
          message: `Case not found in corpus: ${args.caseCitation}`,
        });
      }
      const limit = Math.min(args.limit ?? 100, 200);
      const edges = edgesFromCase(ctx, caseId).slice(0, limit);
      const citations = edges.map((e) => {
        if (e.citedKind === "statute" && e.citedStatuteId !== null) {
          const s = statuteById(ctx, e.citedStatuteId);
          return {
            kind: "statute",
            citedReference: e.citedReference,
            title: s?.short_title ?? null,
            actNumber: s?.act_number ?? null,
          };
        }
        if (e.citedKind === "case" && e.citedCaseId !== null) {
          const c = caseById(ctx, e.citedCaseId);
          return {
            kind: "case",
            citedReference: e.citedReference,
            citation: c?.citation ?? null,
            title: c?.title ?? null,
          };
        }
        return { kind: e.citedKind, citedReference: e.citedReference };
      });
      const c = caseById(ctx, caseId);
      return textResult({
        status: "ok",
        caseCitation: c?.citation ?? args.caseCitation,
        count: citations.length,
        citations,
      });
    },
  );
}
