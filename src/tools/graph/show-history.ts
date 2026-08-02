/**
 * show_history tool (Phase 4). Version history of a provision (valid_from /
 * valid_until ordering) — the corpus's version-aware answer to "what did this
 * provision say before the amendment?" (constraint #4, §14 version correctness).
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { CorpusConnection } from "../../db/connect.js";
import { textResult } from "../result.js";
import { provisionHistory, resolveStatuteId, type GraphContext } from "./queries.js";

const Input = z.object({
  statute: z.string().min(1).describe("Statute short title, e.g. 'Civil Code of the Philippines'"),
  provision: z.string().min(1).describe("Provision number, e.g. '1156' or '266-A'"),
  actNumber: z.string().optional().describe("Optional act number override, e.g. '386'"),
});

const Output = z
  .object({
    status: z.string(),
    statute: z.string().nullable(),
    provision: z.string().nullable(),
    count: z.number(),
    versions: z.array(z.record(z.unknown())),
  })
  .passthrough();

export function registerShowHistory(server: McpServer, conn: CorpusConnection): void {
  server.registerTool(
    "show_history",
    {
      title: "Version history of a provision",
      description:
        "Show every recorded version of a provision, ordered by effective date (valid_from). " +
        "Confirms whether the current text differs from an earlier version.",
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
          provision: null,
          count: 0,
          versions: [],
          message: `Statute not found in corpus: ${args.statute}`,
        });
      }
      const rows = provisionHistory(ctx, statuteId, args.provision);
      if (rows.length === 0) {
        return textResult({
          status: "insufficient_corpus_coverage",
          statute: args.statute,
          provision: args.provision,
          count: 0,
          versions: [],
          message: `Provision not found: ${args.statute} ${args.provision}`,
        });
      }
      return textResult({
        status: "ok",
        statute: args.statute,
        provision: rows[0]!.provision_no,
        count: rows.length,
        versions: rows.map((r) => ({
          provisionNo: r.provision_no,
          heading: r.heading,
          status: r.status,
          validFrom: r.valid_from,
          validUntil: r.valid_until,
          body: r.body,
        })),
      });
    },
  );
}
