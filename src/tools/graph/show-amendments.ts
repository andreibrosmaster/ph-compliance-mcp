/**
 * show_amendments tool (Phase 4). Given a statute, list its amendment log from
 * the laws DB `amendments` table (amending law, provision affected, effective
 * date, summary). Version-aware, constraint #4.
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { CorpusConnection } from "../../db/connect.js";
import { textResult } from "../result.js";
import { amendmentsForStatute, resolveStatuteId, type GraphContext } from "./queries.js";

const Input = z.object({
  statute: z.string().min(1).describe("Statute short title, e.g. 'Civil Code of the Philippines'"),
  actNumber: z.string().optional().describe("Optional act number override, e.g. '386'"),
  limit: z.number().int().min(1).max(100).optional().describe("Max results (default 50, max 100)"),
});

const Output = z
  .object({
    status: z.string(),
    statute: z.string().nullable(),
    count: z.number(),
    amendments: z.array(z.record(z.unknown())),
  })
  .passthrough();

export function registerShowAmendments(server: McpServer, conn: CorpusConnection): void {
  server.registerTool(
    "show_amendments",
    {
      title: "Amendment history of a statute",
      description:
        "List the amendment log for a statute (amending law, affected provision, effective date). " +
        "Use with get_provision to confirm the current text of an amended provision.",
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
          amendments: [],
          message: `Statute not found in corpus: ${args.statute}`,
        });
      }
      const limit = Math.min(args.limit ?? 50, 100);
      const rows = amendmentsForStatute(ctx, statuteId).slice(0, limit);
      return textResult({
        status: "ok",
        statute: args.statute,
        count: rows.length,
        amendments: rows.map((a) => ({
          amendingLaw: a.amending_law,
          amendingLawId: a.amending_law_id,
          provisionNo: a.provision_no,
          effectiveDate: a.effective_date,
          summary: a.summary,
          note: a.note,
        })),
      });
    },
  );
}
