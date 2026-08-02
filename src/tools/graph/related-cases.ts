/**
 * related_cases tool (Phase 4). Given a case citation, find OTHER cases in the
 * corpus that cite the same statutes (shared citation neighborhoods) — a
 * corpus-grounded "similar cases" surface.
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { CorpusConnection } from "../../db/connect.js";
import { textResult } from "../result.js";
import { caseById, resolveCaseId, type GraphContext } from "./queries.js";

const Input = z.object({
  caseCitation: z.string().min(1).describe("Case citation, e.g. 'G.R. No. 238875'"),
  limit: z.number().int().min(1).max(50).optional().describe("Max results (default 10, max 50)"),
});

const Output = z
  .object({
    status: z.string(),
    caseCitation: z.string().nullable(),
    count: z.number(),
    cases: z.array(z.record(z.unknown())),
  })
  .passthrough();

export function registerRelatedCases(server: McpServer, conn: CorpusConnection): void {
  server.registerTool(
    "related_cases",
    {
      title: "Cases citing the same laws",
      description:
        "Given a case citation, find other cases in the corpus that cite at least one of the same statutes " +
        "(shared citation neighborhoods). Useful for identifying lines of jurisprudence.",
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
          cases: [],
          message: `Case not found in corpus: ${args.caseCitation}`,
        });
      }
      const limit = Math.min(args.limit ?? 10, 50);
      const rows = conn.handles.cases
        .prepare(
          `SELECT DISTINCT g2.citing_case_id AS relatedId, count(*) AS shared
           FROM citations_graph g1
           JOIN citations_graph g2
             ON g2.cited_kind = 'statute' AND g1.cited_kind = 'statute'
            AND g2.cited_statute_id = g1.cited_statute_id
            AND g2.citing_case_id <> g1.citing_case_id
           WHERE g1.citing_kind = 'case' AND g1.citing_case_id = ?
             AND g1.cited_statute_id IS NOT NULL
             AND g2.citing_kind = 'case'
           GROUP BY g2.citing_case_id
           ORDER BY shared DESC
           LIMIT ?`,
        )
        .all(caseId, limit) as Array<{ relatedId: number; shared: number }>;

      const cases = rows.map((r) => {
        const c = caseById(ctx, r.relatedId);
        return {
          citation: c?.citation ?? null,
          title: c?.title ?? null,
          court: c?.court ?? null,
          sharedStatutes: r.shared,
        };
      });
      const c = caseById(ctx, caseId);
      return textResult({
        status: "ok",
        caseCitation: c?.citation ?? args.caseCitation,
        count: cases.length,
        cases,
      });
    },
  );
}
