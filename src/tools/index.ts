/**
 * Tool registry — registers every V1 tool on the server (blueprint §9).
 * Graph tools (related_laws, show_amendments, ...) arrive in Phase 4.
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Config } from "../config.js";
import type { CorpusPaths } from "../corpus-loader.js";
import type { CorpusConnection } from "../db/connect.js";
import { registerCiteValidate } from "./cite-validate.js";
import { registerGetCase } from "./get-case.js";
import { registerGetIssuance } from "./get-issuance.js";
import { registerGetProvision } from "./get-provision.js";
import { registerListDomains } from "./list-domains.js";
import { registerSearchIssuance } from "./search-issuance.js";
import { registerSearchJurisprudence } from "./search-jurisprudence.js";
import { registerSearchStatute } from "./search-statute.js";
import { registerGraphTools } from "./graph/index.js";
import { registerComputeDeadline } from "./compute-deadline.js";
import { registerComputePrescription } from "./compute-prescription.js";
import { registerCompute13thMonth } from "./compute-13th-month.js";

export function registerAllTools(
  server: McpServer,
  conn: CorpusConnection,
  paths: CorpusPaths,
  config: Config,
): void {
  registerSearchStatute(server, conn, config);
  registerSearchJurisprudence(server, conn, config);
  registerSearchIssuance(server, conn, config);
  registerGetProvision(server, conn);
  registerGetCase(server, conn);
  registerGetIssuance(server, conn);
  registerCiteValidate(server, conn);
  registerListDomains(server, conn, paths);
  // Phase 4 knowledge-graph tools.
  registerGraphTools(server, conn);
  // Phase 5 deterministic compute tools (pure arithmetic over codal text).
  registerComputePrescription(server);
  registerComputeDeadline(server);
  registerCompute13thMonth(server);
}
