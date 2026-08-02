/**
 * get_provision tool. Exact, version-aware provision lookup by statute +
 * provision number (blueprint §9, constraint #4). Serves current text and
 * surfaces amendment status; a "valid as of" query is Phase 5 scope.
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { CorpusConnection } from "../db/connect.js";
import { textResult } from "./result.js";

const Input = z.object({
  statute: z.string().min(1).describe("Statute short title, e.g. 'Civil Code of the Philippines'"),
  provision: z.string().min(1).describe("Provision number, e.g. '1156' or 'Art. 1156'"),
});

const Output = z
  .object({
    status: z.string(),
    citation: z.string().nullable(),
    provisionNo: z.string().nullable(),
    body: z.string().nullable(),
  })
  .passthrough();

export function registerGetProvision(server: McpServer, conn: CorpusConnection): void {
  server.registerTool(
    "get_provision",
    {
      title: "Get a statute provision",
      description:
        "Return the exact text of a provision (e.g. Civil Code Art. 1156) with its current status. " +
        "Version-aware: reports amended/repealed/superseded status when the corpus tracks it.",
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
      const provisionNo = args.provision
        .replace(/^(art\.?\s*|article\s*|sec\.?\s*|section\s*)/i, "")
        .trim();

      const row = conn.db
        .prepare(
          `SELECT s.short_title, s.official_title, s.kind, s.domain, s.status AS statute_status,
                  p.provision_no, p.heading, p.body, p.status AS provision_status,
                  p.valid_from, p.valid_until
           FROM provisions p
           JOIN statutes s ON s.id = p.statute_id
           WHERE lower(s.short_title) = lower(?)
             AND lower(p.provision_no) = lower(?)
           ORDER BY p.valid_from DESC
           LIMIT 1`,
        )
        .get(args.statute, provisionNo) as
        | {
            short_title: string;
            official_title: string;
            kind: string;
            domain: string;
            statute_status: string;
            provision_no: string;
            heading: string | null;
            body: string;
            provision_status: string;
            valid_from: string | null;
            valid_until: string | null;
          }
        | undefined;

      if (!row) {
        return textResult({
          status: "insufficient_corpus_coverage",
          message: `Provision not found in corpus: ${args.statute} ${args.provision}.`,
          citation: null,
          provisionNo: null,
          body: null,
        });
      }

      return textResult({
        status: "ok",
        citation: `${row.short_title}, ${row.provision_no}${row.heading ? " (" + row.heading + ")" : ""}`,
        statute: row.short_title,
        officialTitle: row.official_title,
        kind: row.kind,
        domain: row.domain,
        provisionNo: row.provision_no,
        heading: row.heading,
        body: row.body,
        provisionStatus: row.provision_status,
        statuteStatus: row.statute_status,
        validFrom: row.valid_from,
        validUntil: row.valid_until,
      });
    },
  );
}
