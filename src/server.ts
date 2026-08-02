/**
 * ph-compliance MCP server entry point (blueprint §3, §5; ADR-004 rename).
 *
 * Local stdio transport: the agent spawns this package as a subprocess and
 * speaks JSON-RPC over stdin/stdout. No hosted server, no auth, no network
 * exposure. Corpus assets are downloaded + checksum-verified on first run.
 *
 * Run:  pnpm dev        (tsx)
 *       node dist/server.js   (built)
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { SERVER_NAME, SERVER_VERSION, loadConfig } from "./config.js";
import { ensureCorpus } from "./corpus-loader.js";
import { connectCorpus } from "./db/connect.js";
import { registerResources } from "./resources/register.js";
import { registerAllTools } from "./tools/index.js";

async function main(): Promise<void> {
  const config = loadConfig();

  const paths = await ensureCorpus(config);
  const conn = connectCorpus(paths);

  // MCP SDK v1.30: implementation info is the first arg; instructions is a
  // ServerOption (second arg), not part of Implementation.
  const server = new McpServer(
    { name: SERVER_NAME, version: SERVER_VERSION },
    {
      instructions:
        "Philippine Legal & Compliance MCP (ph-compliance). A retrieval-grounded source-of-truth layer for " +
        "Philippine law and compliance: statutes (Republic Acts, Presidential Decrees, Executive Orders, codes), " +
        "jurisprudence (G.R. decisions), and government issuances (NGA memorandums/circulars, LGU issuances, " +
        "GOCC rules). Information retrieval, not legal advice. Every response carries structured citations " +
        "resolved against the corpus; below the confidence threshold tools return 'insufficient corpus " +
        "coverage' rather than guessing. Check list_domains for corpus freshness before relying on results. " +
        "Use show_amendments / show_history for version-aware law; use the graph tools (related_laws, " +
        "related_cases, show_dependencies) for citation-aware research.",
    },
  );

  registerAllTools(server, conn, paths, config);
  registerResources(server, conn, paths);

  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write(`ph-compliance-mcp ${SERVER_VERSION} serving over stdio (corpus cached at ${config.cacheDir})\n`);
}

main().catch((err) => {
  process.stderr.write(`ph-compliance-mcp failed to start: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
