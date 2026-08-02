/**
 * compute_prescription tool (Phase 5). Deterministic prescriptive-period
 * calculator grounded in Civil Code Arts. 1144-1149 (RA 386). Returns the
 * codal period for a class of action, the exact article(s), and — when a cause
 * of action date is supplied — the computed deadline.
 *
 * This is arithmetic over codal text, not retrieval: the cited articles are
 * the authority, and the tool always returns them so agents can verify with
 * get_provision / cite_validate. It never states law beyond the codal text.
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { textResult } from "./result.js";

/** Prescription classes keyed to Civil Code articles (RA 386, Book IV). */
const PERIODS = [
  {
    key: "written_contract",
    years: 10,
    article: "Art. 1144(1)",
    category: "Upon a written contract",
  },
  {
    key: "obligation_created_by_law",
    years: 10,
    article: "Art. 1144(2)",
    category: "Upon an obligation created by law",
  },
  {
    key: "judgment",
    years: 10,
    article: "Art. 1144(3)",
    category: "Upon a judgment",
  },
  {
    key: "oral_contract",
    years: 6,
    article: "Art. 1145(1)",
    category: "Upon an oral contract",
  },
  {
    key: "quasi_contract",
    years: 6,
    article: "Art. 1145(2)",
    category: "Upon a quasi-contract",
  },
  {
    key: "injury_to_rights",
    years: 4,
    article: "Art. 1146(1)",
    category: "Upon an injury to the rights of the plaintiff",
  },
  {
    key: "quasi_delict",
    years: 4,
    article: "Art. 1146(2)",
    category: "Upon a quasi-delict (tort)",
  },
  {
    key: "forcible_entry_detainer",
    years: 1,
    article: "Art. 1147(1)",
    category: "For forcible entry and detainer",
  },
  {
    key: "defamation",
    years: 1,
    article: "Art. 1147(2)",
    category: "For defamation",
  },
] as const;

/** Residual catch-all, Art. 1149. */
const RESIDUAL = { years: 5, article: "Art. 1149", category: "All other actions whose periods are not fixed in the Code or other laws" };

type ActionKey = (typeof PERIODS)[number]["key"] | "other";
// z.enum requires a non-empty tuple; the spread of PERIODS.map is widened to
// an array, so assert the tuple shape. Runtime values are exactly the 9 codal
// keys + "other" (derived from PERIODS, so they cannot drift).
const ACTION_KEYS = [...PERIODS.map((p) => p.key), "other"] as unknown as readonly [ActionKey, ...ActionKey[]];
const ActionType = z.enum(ACTION_KEYS);

const Input = z.object({
  actionType: ActionType.describe("Class of action; 'other' uses the Art. 1149 residual period"),
  causeOfActionDate: z.string().optional().describe("ISO date (YYYY-MM-DD) the right of action accrued, to compute the deadline"),
});

const Output = z
  .object({
    status: z.string(),
    years: z.number(),
    article: z.string(),
    category: z.string(),
  })
  .passthrough();

/** Parse YYYY-MM-DD as local date (avoids UTC off-by-one). */
function parseIso(date: string): Date | undefined {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) return undefined;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? undefined : d;
}

/** Add whole years to a date (calendar-day anniversary). */
function addYears(d: Date, years: number): Date {
  return new Date(d.getFullYear() + years, d.getMonth(), d.getDate());
}

function toIso(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

export function registerComputePrescription(server: McpServer): void {
  server.registerTool(
    "compute_prescription",
    {
      title: "Compute a prescriptive period under the Civil Code",
      description:
        "Deterministic prescriptive-period calculator under Civil Code Arts. 1144-1149 (RA 386). " +
        "Pick the class of action to get the codal period in years, the exact article, and — if a " +
        "cause-of-action date is given — the computed deadline. The computation is arithmetic over " +
        "the cited articles; verify the codal text with get_provision or cite_validate before relying " +
        "on it, and note that interruption (Art. 1155) can extend the deadline in practice. " +
        "Not legal advice.",
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
      const period = args.actionType === "other" ? RESIDUAL : PERIODS.find((p) => p.key === args.actionType)!;

      let deadline: string | null = null;
      let deadlineNote: string | null = null;
      if (args.causeOfActionDate) {
        const start = parseIso(args.causeOfActionDate);
        if (!start) {
          return textResult({
            status: "invalid_date",
            message: "causeOfActionDate must be an ISO date (YYYY-MM-DD).",
            years: period.years,
            article: period.article,
            category: period.category,
            deadline: null,
          });
        }
        deadline = toIso(addYears(start, period.years));
        deadlineNote =
          "Computed from the accrual date as a calendar-day anniversary; Civil Code Art. 1155 provides " +
          "that prescription is interrupted by a written extrajudicial demand, a judicial claim, or " +
          "acknowledgment of the right, restarting the period.";
      }

      return textResult({
        status: "ok",
        years: period.years,
        article: period.article,
        category: period.category,
        authority: "Civil Code of the Philippines (RA 386), Book IV, Arts. 1144-1149",
        residualNote:
          args.actionType === "other"
            ? "Residual 5-year period under Art. 1149 applies only where no specific period is fixed by the Civil Code or other laws."
            : undefined,
        causeOfActionDate: args.causeOfActionDate ?? null,
        deadline,
        deadlineNote,
      });
    },
  );
}
