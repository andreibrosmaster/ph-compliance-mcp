/**
 * related_laws tool (Phase 4). Given a case citation, list the statutes it
 * cites (citations_graph edges, resolved against laws.sqlite). Only resolved,
 * corpus-backed edges are served (constraint #1).
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { CorpusConnection } from "../../db/connect.js";
import { textResult } from "../result.js";
import { caseById, edgesFromCase, resolveCaseId, statuteById, type GraphContext } from "./queries.js";

const Input = z.object({
  caseCitation: z.string().min(1).describe("Case citation, e.g. 'G.R. No. 238875'"),
  limit: z.number().int().min(1).max(50).optional().describe("Max results (default 20, max 50)"),
});

const Output = z
  .object({
    status: z.string(),
    caseCitation: z.string().nullable(),
    count: z.number(),
    laws: z.array(z.record(z.unknown())),
  })
  .passthrough();

export function registerRelatedLaws(server: McpServer, conn: CorpusConnection): void {
  server.registerTool(
    "related_laws",
    {
      title: "Laws cited by a case",
      description:
        "Given a case citation (G.R. No.), list the statutes that case cites, resolved against the corpus. " +
        "Only citations that resolve to an ingested statute are returned.",
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
          laws: [],
          message: `Case not found in corpus: ${args.caseCitation}`,
        });
      }
      const limit = Math.min(args.limit ?? 20, 50);
      const edges = edgesFromCase(ctx, caseId)
        .filter((e) => e.citedKind === "statute" && e.citedStatuteId !== null)
        .slice(0, limit);
      const laws = edges.map((e) => {
        const s = statuteById(ctx, e.citedStatuteId!);
        return {
          citedReference: e.citedReference,
          statuteId: e.citedStatuteId,
          shortTitle: s?.short_title ?? null,
          officialTitle: s?.official_title ?? null,
          domain: s?.domain ?? null,
          actNumber: s?.act_number ?? null,
        };
      });
      const c = caseById(ctx, caseId);
      return textResult({
        status: "ok",
        caseCitation: c?.citation ?? args.caseCitation,
        count: laws.length,
        laws,
      });
    },
  );
}
