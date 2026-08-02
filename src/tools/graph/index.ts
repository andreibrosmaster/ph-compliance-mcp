/**
 * Graph tool registry (Phase 4, blueprint §9). Registers the 8 knowledge-graph
 * tools, all backed by citations_graph (cases.sqlite) + laws.sqlite reads.
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CorpusConnection } from "../../db/connect.js";
import { registerRelatedCases } from "./related-cases.js";
import { registerRelatedLaws } from "./related-laws.js";
import { registerShowAmendments } from "./show-amendments.js";
import { registerShowCitations } from "./show-citations.js";
import { registerShowCrossReferences } from "./show-cross-references.js";
import { registerShowDependencies } from "./show-dependencies.js";
import { registerShowHistory } from "./show-history.js";
import { registerShowImplementingRules } from "./show-implementing-rules.js";

export function registerGraphTools(server: McpServer, conn: CorpusConnection): void {
  registerRelatedLaws(server, conn);
  registerRelatedCases(server, conn);
  registerShowAmendments(server, conn);
  registerShowHistory(server, conn);
  registerShowDependencies(server, conn);
  registerShowCitations(server, conn);
  registerShowImplementingRules(server, conn);
  registerShowCrossReferences(server, conn);
}
