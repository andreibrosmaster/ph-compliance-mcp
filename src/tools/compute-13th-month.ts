/**
 * compute_13th_month tool (Phase 5). Deterministic 13th-month-pay calculator
 * under PD 851 (Dec 16, 1975), as amended by Memorandum Order No. 28 (Aug 13,
 * 1986, which removed the ₱1,000/month salary ceiling), and the Rules
 * Implementing PD 851.
 *
 * Formula: total basic salary earned within the calendar year ÷ 12, paid on or
 * before December 24. The tool is arithmetic over the cited rule; the caller
 * verifies the rule text (and current DOLE advisories) with the corpus before
 * relying on it. Not legal advice.
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { textResult } from "./result.js";

const Input = z.object({
  totalBasicSalary: z
    .number()
    .nonnegative()
    .describe(
      "Total basic salary earned within the calendar year (PHP). For an employee who did not work the " +
      "full year, pass the amount actually earned during the months worked — the formula divides the " +
      "year's earned basic salary by 12, which pro-rates automatically.",
    ),
});

const Output = z
  .object({
    status: z.string(),
    amount: z.number().nullable(),
  })
  .passthrough();

export function registerCompute13thMonth(server: McpServer): void {
  server.registerTool(
    "compute_13th_month",
    {
      title: "Compute 13th-month pay under PD 851",
      description:
        "Deterministic 13th-month-pay calculator under PD 851 (as amended by Memorandum Order No. 28 and the " +
        "Rules Implementing PD 851). Computes total basic salary earned within the calendar year ÷ 12 for " +
        "rank-and-file employees (pro-rated automatically for partial-year service), and returns " +
        "coverage/exclusion notes plus the payment deadline (on or before December 24). Verify the rule text " +
        "and current DOLE advisories with the corpus before relying on it. Not legal advice.",
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
      // PD 851, Rules Implementing PD 851 Sec. 2(a): 13th month pay = total
      // basic salary earned within the calendar year ÷ 12. A partial year is
      // handled naturally because the input is what was actually earned.
      const amount = Number((args.totalBasicSalary / 12).toFixed(2));

      return textResult({
        status: "ok",
        formula: "total basic salary earned within the calendar year ÷ 12",
        totalBasicSalary: args.totalBasicSalary,
        amount,
        payableOnOrBefore: "December 24 of the calendar year",
        coverage:
          "Rank-and-file employees, regardless of the amount of basic salary (salary ceiling removed by " +
          "Memorandum Order No. 28, Aug 13, 1986).",
        exclusions:
          "Government and political subdivisions (incl. GOCCs operating as government agencies, except private " +
          "subsidiaries); employers already paying an equivalent or higher 13th-month pay/bonus (≥ 1/12 of " +
          "basic salary); household helpers and persons in the personal service of another; workers paid on a " +
          "purely commission, boundary, or task basis (piece-rate workers ARE covered).",
        authority: "PD 851; Memorandum Order No. 28 (1986); Rules Implementing PD 851, Sec. 2(a)",
        verify: "Check current DOLE advisories and the collected rules via get_issuance / search_issuance (agency DOLE).",
      });
    },
  );
}
