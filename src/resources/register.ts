/**
 * MCP resource registration (mcp-builder skill: node_mcp_server.md "Advanced
 * Features"). Exposes URI-addressable data that agents can read directly:
 *   - ph-compliance://domains            → the domain taxonomy + freshness
 *   - ph-compliance://statute/{statute}  → statute metadata + provisions overview
 *
 * Resources are read-only and idempotent; use tools for complex operations.
 *
 * NOTE: This targets the MCP SDK v1.30+ API — `registerResource(name, uriOrTemplate,
 * config, readCallback)` with `(uri: URL, variables, extra)` callbacks.
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CorpusPaths } from "../corpus-loader.js";
import type { CorpusConnection } from "../db/connect.js";
import { listDomains } from "./domain-index.js";

function asString(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : String(value ?? "");
}

export function registerResources(
  server: McpServer,
  conn: CorpusConnection,
  paths: CorpusPaths,
): void {
  server.registerResource(
    "Law domains index",
    "ph-compliance://domains",
    {
      description: "The 15-domain compliance taxonomy (ADR-000 core + ADR-004 expansion) with corpus freshness timestamps",
      mimeType: "application/json",
    },
    async (uri: URL) => {
      const domains = await listDomains(conn.db, paths);
      return {
        contents: [
          {
            uri: uri.toString(),
            mimeType: "application/json",
            text: JSON.stringify({ domains }, null, 2),
          },
        ],
      };
    },
  );

  server.registerResource(
    "Statute overview",
    new ResourceTemplate("ph-compliance://statute/{statute}", { list: undefined }),
    {
      description:
        "Metadata and provision list for a statute by short title, e.g. " +
        "ph-compliance://statute/Civil Code of the Philippines",
      mimeType: "application/json",
    },
    async (uri: URL, variables) => {
      const title = asString(variables["statute"]).trim();
      const row = conn.db
        .prepare(
          `SELECT id, short_title, official_title, kind, domain, enacted_date, status
           FROM statutes WHERE lower(short_title) = lower(?) LIMIT 1`,
        )
        .get(title) as
        | {
            id: number;
            short_title: string;
            official_title: string;
            kind: string;
            domain: string;
            enacted_date: string | null;
            status: string;
          }
        | undefined;

      if (!row) {
        return {
          contents: [
            {
              uri: uri.toString(),
              mimeType: "application/json",
              text: JSON.stringify(
                { status: "not_found", message: `Statute not found: ${title}` },
                null,
                2,
              ),
            },
          ],
        };
      }

      const provisions = conn.db
        .prepare(
          `SELECT provision_no, heading, status FROM provisions
           WHERE statute_id = ? ORDER BY CAST(provision_no AS INTEGER), provision_no LIMIT 100`,
        )
        .all(row.id) as Array<{ provision_no: string; heading: string | null; status: string }>;

      return {
        contents: [
          {
            uri: uri.toString(),
            mimeType: "application/json",
            text: JSON.stringify(
              {
                statute: row.short_title,
                officialTitle: row.official_title,
                kind: row.kind,
                domain: row.domain,
                enactedDate: row.enacted_date,
                status: row.status,
                provisionCount: provisions.length,
                provisions: provisions.map((p) => ({
                  provisionNo: p.provision_no,
                  heading: p.heading,
                  status: p.status,
                })),
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );
}
