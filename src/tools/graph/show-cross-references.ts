/**
 * show_cross_references tool (Phase 4). Surfaces the curated cross-domain
 * references from the domain registry (Phase 3) for a statute's domain, plus
 * the statute→statute citation edges from the graph. This is the bridge
 * between the domain taxonomy and the citations graph.
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { CorpusConnection } from "../../db/connect.js";
import { allDomainModules } from "../../domains/index.js";
import { textResult } from "../result.js";
import { edgesFromStatute, resolveStatuteId, statuteById, type GraphContext } from "./queries.js";

const Input = z.object({
  statute: z.string().min(1).describe("Statute short title, e.g. 'Civil Code of the Philippines'"),
  actNumber: z.string().optional().describe("Optional act number override, e.g. '386'"),
  limit: z.number().int().min(1).max(100).optional().describe("Max graph edges (default 50, max 100)"),
});

const Output = z
  .object({
    status: z.string(),
    statute: z.string().nullable(),
    domain: z.string().nullable(),
    count: z.number(),
    crossReferences: z.array(z.record(z.unknown())),
  })
  .passthrough();

export function registerShowCrossReferences(server: McpServer, conn: CorpusConnection): void {
  server.registerTool(
    "show_cross_references",
    {
      title: "Cross-references for a statute",
      description:
        "Curated cross-domain references (from the domain registry) for the statute's domain, " +
        "plus statute→statute citation edges from the corpus graph.",
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
          domain: null,
          count: 0,
          crossReferences: [],
          message: `Statute not found in corpus: ${args.statute}`,
        });
      }
      const s = statuteById(ctx, statuteId);
      const domain = s?.domain ?? null;

      const domainModule = domain ? allDomainModules().find((d) => d.module.slug === domain) : undefined;
      const curated = (domainModule?.crossRefs ?? []).map((ref) => {
        const target = allDomainModules().find((d) => d.module.slug === ref.target);
        return {
          kind: "domain",
          targetSlug: ref.target,
          targetName: target?.module.name ?? ref.target,
          reason: ref.reason,
        };
      });

      const limit = Math.min(args.limit ?? 50, 100);
      const graphEdges = edgesFromStatute(ctx, statuteId)
        .filter((e) => e.citedKind === "statute" && e.citedStatuteId !== null)
        .slice(0, limit)
        .map((e) => {
          const cited = statuteById(ctx, e.citedStatuteId!);
          return {
            kind: "statute",
            citedReference: e.citedReference,
            shortTitle: cited?.short_title ?? null,
            actNumber: cited?.act_number ?? null,
          };
        });

      const crossReferences = [...curated, ...graphEdges];
      return textResult({
        status: "ok",
        statute: args.statute,
        domain,
        count: crossReferences.length,
        crossReferences,
      });
    },
  );
}
