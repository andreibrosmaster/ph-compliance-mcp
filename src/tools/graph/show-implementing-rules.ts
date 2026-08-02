/**
 * show_implementing_rules tool (Phase 4). Finds corpus references to the
 * Implementing Rules and Regulations (IRR) of a statute — citations whose raw
 * reference mentions IRR and resolves to the statute.
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { CorpusConnection } from "../../db/connect.js";
import { textResult } from "../result.js";
import { caseById, irrReferencesForStatute, resolveStatuteId, type GraphContext } from "./queries.js";

const Input = z.object({
  statute: z.string().min(1).describe("Statute short title, e.g. 'Data Privacy Act of 2012'"),
  actNumber: z.string().optional().describe("Optional act number override, e.g. '10173'"),
  limit: z.number().int().min(1).max(100).optional().describe("Max results (default 50, max 100)"),
});

const Output = z
  .object({
    status: z.string(),
    statute: z.string().nullable(),
    count: z.number(),
    references: z.array(z.record(z.unknown())),
  })
  .passthrough();

export function registerShowImplementingRules(server: McpServer, conn: CorpusConnection): void {
  server.registerTool(
    "show_implementing_rules",
    {
      title: "Implementing rules references for a statute",
      description:
        "Find corpus references to the Implementing Rules and Regulations (IRR) of a statute — " +
        "citations mentioning IRR that resolve to the statute, with the citing cases.",
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
      const statuteId = resolveStatuteId(ctx, args.statute, args.actNumber);
      if (statuteId === null) {
        return textResult({
          status: "insufficient_corpus_coverage",
          statute: null,
          count: 0,
          references: [],
          message: `Statute not found in corpus: ${args.statute}`,
        });
      }
      const limit = Math.min(args.limit ?? 50, 100);
      const edges = irrReferencesForStatute(ctx, statuteId).slice(0, limit);
      const references = edges.map((e) => {
        const citing = e.citingKind === "case" && e.citingCaseId !== null ? caseById(ctx, e.citingCaseId) : null;
        return {
          citedReference: e.citedReference,
          citingCitation: citing?.citation ?? null,
          citingTitle: citing?.title ?? null,
        };
      });
      return textResult({
        status: "ok",
        statute: args.statute,
        count: references.length,
        references,
      });
    },
  );
}
