/**
 * show_dependencies tool (Phase 4). Law→law dependency edges: statutes a
 * given statute cites, and statutes that cite it back (both directions are
 * corpus-grounded via citations_graph, citing_kind='statute').
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { CorpusConnection } from "../../db/connect.js";
import { textResult } from "../result.js";
import {
  edgesFromStatute,
  resolveStatuteId,
  statutesCitingStatute,
  statuteById,
  type GraphContext,
} from "./queries.js";

const Input = z.object({
  statute: z.string().min(1).describe("Statute short title, e.g. 'National Internal Revenue Code'"),
  actNumber: z.string().optional().describe("Optional act number override, e.g. '8424'"),
  limit: z.number().int().min(1).max(100).optional().describe("Max results per direction (default 50, max 100)"),
});

const Output = z
  .object({
    status: z.string(),
    statute: z.string().nullable(),
    count: z.number(),
    dependencies: z.array(z.record(z.unknown())),
    dependentOn: z.array(z.record(z.unknown())),
  })
  .passthrough();

export function registerShowDependencies(server: McpServer, conn: CorpusConnection): void {
  server.registerTool(
    "show_dependencies",
    {
      title: "Statute dependency graph",
      description:
        "Show which statutes a statute cites (dependencies) and which statutes cite it back (dependentOn), " +
        "from corpus-grounded law→law edges.",
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
          dependencies: [],
          dependentOn: [],
          message: `Statute not found in corpus: ${args.statute}`,
        });
      }
      const limit = Math.min(args.limit ?? 50, 100);

      const deps = edgesFromStatute(ctx, statuteId)
        .filter((e) => e.citedKind === "statute" && e.citedStatuteId !== null)
        .slice(0, limit)
        .map((e) => {
          const s = statuteById(ctx, e.citedStatuteId!);
          return {
            citedReference: e.citedReference,
            shortTitle: s?.short_title ?? null,
            actNumber: s?.act_number ?? null,
            domain: s?.domain ?? null,
          };
        });

      const dependents = statutesCitingStatute(ctx, statuteId)
        .slice(0, limit)
        .map((r) => {
          const s = statuteById(ctx, r.statuteId);
          return { shortTitle: s?.short_title ?? null, actNumber: s?.act_number ?? null };
        });

      return textResult({
        status: "ok",
        statute: args.statute,
        count: deps.length,
        dependencies: deps,
        dependentOn: dependents,
      });
    },
  );
}
