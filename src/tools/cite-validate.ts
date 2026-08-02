/**
 * cite_validate tool — the standing hallucination check (blueprint §10).
 * Attempts to resolve a citation (statute+provision or case G.R.) against the
 * corpus. Returns the resolved citation + exact text or a clear "cannot
 * validate" verdict. Never guesses.
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { CorpusConnection } from "../db/connect.js";
import { textResult } from "./result.js";

const Input = z.object({
  statute: z.string().optional().describe("Statute short title, e.g. 'Civil Code of the Philippines'"),
  provision: z.string().optional().describe("Provision number, e.g. '1156'"),
  caseCitation: z.string().optional().describe("Case citation, e.g. 'G.R. No. 238875'"),
});

const Output = z
  .object({
    status: z.string(),
    citation: z.string().nullable(),
  })
  .passthrough();

export function registerCiteValidate(server: McpServer, conn: CorpusConnection): void {
  server.registerTool(
    "cite_validate",
    {
      title: "Validate a legal citation against the corpus",
      description:
        "Resolve a citation against the corpus and return the exact matching text. " +
        "If the citation cannot be resolved, it returns a clear 'cannot validate' verdict — " +
        "it never fills in plausible text. Use this before relying on any AI-generated citation.",
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
      if (args.caseCitation) {
        const row = conn.handles.cases
          .prepare("SELECT citation, title FROM cases WHERE lower(citation) = lower(?) LIMIT 1")
          .get(args.caseCitation) as { citation: string; title: string } | undefined;
        if (!row) {
          return textResult({
            status: "cannot_validate",
            citation: args.caseCitation,
            message: "Citation not found in case corpus.",
          });
        }
        return textResult({ status: "validated", citation: row.citation, title: row.title });
      }

      if (!args.statute) {
        return textResult({
          status: "invalid_request",
          citation: null,
          message: "Provide either caseCitation or statute (optionally with provision).",
        });
      }

      const provisionNo = (args.provision ?? "")
        .replace(/^(art\.?\s*|article\s*|sec\.?\s*|section\s*)/i, "")
        .trim();

      const row = conn.db
        .prepare(
          `SELECT s.short_title, p.provision_no, p.heading, p.body, p.status
           FROM provisions p
           JOIN statutes s ON s.id = p.statute_id
           WHERE lower(s.short_title) = lower(?)
             ${provisionNo ? "AND lower(p.provision_no) = lower(?)" : ""}
           ORDER BY p.valid_from DESC
           LIMIT 1`,
        )
        .get(...(provisionNo ? [args.statute, provisionNo] : [args.statute])) as
        | {
            short_title: string;
            provision_no: string;
            heading: string | null;
            body: string;
            status: string;
          }
        | undefined;

      if (!row) {
        return textResult({
          status: "cannot_validate",
          citation: args.provision ? `${args.statute} ${args.provision}` : args.statute,
          message: "Citation not found in statute corpus.",
        });
      }
      return textResult({
        status: "validated",
        citation: `${row.short_title}, ${row.provision_no}${row.heading ? " (" + row.heading + ")" : ""}`,
        provisionStatus: row.status,
        body: row.body,
      });
    },
  );
}
