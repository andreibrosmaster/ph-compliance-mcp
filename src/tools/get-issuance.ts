/**
 * get_issuance tool (Phase 3). Exact issuance lookup by agency + reference
 * number (e.g. BIR RMC 85-2023), returning metadata plus passages. Passages are
 * defensively truncated via withCharacterLimit.
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { CorpusConnection } from "../db/connect.js";
import { textResult, withCharacterLimit } from "./result.js";

const PASSAGE_LIMIT = 20;

const Input = z.object({
  agency: z.string().min(1).describe("Agency code, e.g. 'BIR'"),
  referenceNo: z.string().min(1).describe("Reference number, e.g. 'RMC 85-2023'"),
  limit: z.number().int().min(1).max(100).optional().describe(`Max passages to return (default ${PASSAGE_LIMIT})`),
});

const Output = z
  .object({
    status: z.string(),
    referenceNo: z.string().nullable(),
    title: z.string().nullable(),
  })
  .passthrough();

export function registerGetIssuance(server: McpServer, conn: CorpusConnection): void {
  server.registerTool(
    "get_issuance",
    {
      title: "Get an agency issuance",
      description:
        "Return an issuance by agency + reference number (e.g. 'BIR' / 'RMC 85-2023') with metadata " +
        "and the first passages of the document.",
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
      const row = conn.handles.issuances
        .prepare(
          `SELECT id, agency, issuance_type, reference_no, title, issue_date, status, source_url
           FROM issuances WHERE lower(agency) = lower(?) AND lower(reference_no) = lower(?) LIMIT 1`,
        )
        .get(args.agency, args.referenceNo) as
        | {
            id: number;
            agency: string;
            issuance_type: string;
            reference_no: string;
            title: string | null;
            issue_date: string | null;
            status: string;
            source_url: string | null;
          }
        | undefined;

      if (!row) {
        return textResult({
          status: "insufficient_corpus_coverage",
          message: `Issuance not found in corpus: ${args.agency} ${args.referenceNo}`,
          referenceNo: null,
          title: null,
        });
      }

      const passages = conn.handles.issuances
        .prepare(
          `SELECT passage_no, heading, body FROM issuance_passages
           WHERE issuance_id = ? ORDER BY passage_no LIMIT ?`,
        )
        .all(row.id, limit) as Array<{ passage_no: number; heading: string | null; body: string }>;

      return textResult(
        withCharacterLimit(
          {
            status: "ok",
            agency: row.agency,
            issuanceType: row.issuance_type,
            referenceNo: row.reference_no,
            title: row.title,
            issueDate: row.issue_date,
            issuanceStatus: row.status,
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
