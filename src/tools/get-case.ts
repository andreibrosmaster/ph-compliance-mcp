/**
 * get_case tool. Exact case lookup by G.R. citation, returning metadata plus
 * the first passages (blueprint §9). Passages are truncated defensively via
 * withCharacterLimit so a single response cannot overwhelm client context
 * (mcp-builder best-practices).
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { CorpusConnection } from "../db/connect.js";
import { textResult, withCharacterLimit } from "./result.js";

const PASSAGE_LIMIT = 20;

const Input = z.object({
  citation: z.string().min(1).describe("Case citation, e.g. 'G.R. No. 238875'"),
  limit: z.number().int().min(1).max(100).optional().describe(`Max passages to return (default ${PASSAGE_LIMIT})`),
});

const Output = z
  .object({
    status: z.string(),
    citation: z.string().nullable(),
    title: z.string().nullable(),
  })
  .passthrough();

export function registerGetCase(server: McpServer, conn: CorpusConnection): void {
  server.registerTool(
    "get_case",
    {
      title: "Get a case",
      description:
        "Return a case by citation (e.g. 'G.R. No. 238875') with metadata and the first passages of the decision.",
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
      const limit = Math.min(args.limit ?? PASSAGE_LIMIT, 100);
      const row = conn.handles.cases
        .prepare(
          `SELECT id, citation, title, court, promulgation_date, ponente, division, status, source_url
           FROM cases WHERE lower(citation) = lower(?) LIMIT 1`,
        )
        .get(args.citation) as
        | {
            id: number;
            citation: string;
            title: string;
            court: string;
            promulgation_date: string | null;
            ponente: string | null;
            division: string | null;
            status: string;
            source_url: string | null;
          }
        | undefined;

      if (!row) {
        return textResult({
          status: "insufficient_corpus_coverage",
          message: `Case not found in corpus: ${args.citation}`,
          citation: null,
          title: null,
        });
      }

      const passages = conn.handles.cases
        .prepare(
          `SELECT passage_no, heading, body FROM case_passages
           WHERE case_id = ? ORDER BY passage_no LIMIT ?`,
        )
        .all(row.id, limit) as Array<{ passage_no: number; heading: string | null; body: string }>;

      return textResult(
        withCharacterLimit(
          {
            status: "ok",
            citation: row.citation,
            title: row.title,
            court: row.court,
            promulgationDate: row.promulgation_date,
            ponente: row.ponente,
            division: row.division,
            caseStatus: row.status,
            sourceUrl: row.source_url,
            passageCount: passages.length,
            passages,
          },
          "passages",
        ),
      );
    },
  );
}
