/**
 * compute_deadline tool (Phase 5). Deterministic filing-deadline calculator
 * under the Rules of Court: Rule 22 computation of time (exclude the first
 * day, include the last; a last day on a Saturday, Sunday, or legal holiday
 * runs to the next working day) applied to the common reglementary periods.
 *
 * Rule citations (2019 Rules of Civil Procedure, A.M. No. 19-10-20-SC):
 *   - Rule 37 §1  motion for new trial / reconsideration — 15 days, no extension
 *   - Rule 41 §3  ordinary appeal RTC → CA — 15 days (30 days when a record on appeal is required)
 *   - Rule 45 §2  appeal by certiorari to the SC — 15 days (+ up to 30 more on motion)
 *   - Rule 65 §4  certiorari / prohibition / mandamus — 60 days from notice (or from denial of MR/MT)
 *
 * Holidays are taken from an explicit list (national holidays are declared per
 * year by proclamation; the caller — or the corpus — supplies them). Never
 * fabricates the holiday calendar.
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { textResult } from "./result.js";

const FilingType = z.enum([
  "motion_new_trial",
  "motion_reconsideration",
  "appeal_rtc_to_ca",
  "appeal_rtc_to_ca_record_on_appeal",
  "appeal_certiorari_sc",
  "certiorari_prohibition_mandamus",
]);

const PERIODS: Record<z.infer<typeof FilingType>, { days: number; rule: string; note?: string }> = {
  motion_new_trial: { days: 15, rule: "Rule 37, Sec. 1", note: "No extension allowed." },
  motion_reconsideration: { days: 15, rule: "Rule 37, Sec. 1", note: "No extension allowed." },
  appeal_rtc_to_ca: { days: 15, rule: "Rule 41, Sec. 3(a)" },
  appeal_rtc_to_ca_record_on_appeal: {
    days: 30,
    rule: "Rule 41, Sec. 3(a)",
    note: "30 days when a record on appeal is required (special proceedings, multiple appeals).",
  },
  appeal_certiorari_sc: {
    days: 15,
    rule: "Rule 45, Sec. 2",
    note: "The Court may grant an additional period not exceeding 30 days on motion (pass extensionDays).",
  },
  certiorari_prohibition_mandamus: {
    days: 60,
    rule: "Rule 65, Sec. 4",
    note: "Counted from notice of the judgment/order/resolution, or from denial of a timely MR/MT.",
  },
};

const Input = z.object({
  filingType: FilingType.describe("Which reglementary period to compute"),
  noticeDate: z.string().describe("ISO date (YYYY-MM-DD) of notice of the judgment, order, or resolution"),
  holidays: z
    .array(z.string())
    .optional()
    .describe("ISO dates of legal holidays (national holidays are declared per year by proclamation)"),
  extensionDays: z
    .number()
    .int()
    .min(1)
    .max(30)
    .optional()
    .describe("Extra days for appeal_certiorari_sc (Rule 45 §2, max 30)"),
});

const Output = z
  .object({
    status: z.string(),
    lastDay: z.string().nullable(),
  })
  .passthrough();

/** Parse YYYY-MM-DD as local date (avoids UTC off-by-one). */
function parseIso(date: string): Date | undefined {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) return undefined;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function toIso(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

function isWeekend(d: Date): boolean {
  return d.getDay() === 0 || d.getDay() === 6; // Sunday, Saturday
}

function isHoliday(d: Date, holidays: Set<string>): boolean {
  return holidays.has(toIso(d));
}

/** Rule 22: exclude first day; if the last day lands on a non-working day,
 * run to the next working day. */
function lastWorkingDay(start: Date, days: number, holidays: Set<string>): Date {
  const d = new Date(start);
  d.setDate(d.getDate() + days);
  while (isWeekend(d) || isHoliday(d, holidays)) {
    d.setDate(d.getDate() + 1);
  }
  return d;
}

export function registerComputeDeadline(server: McpServer): void {
  server.registerTool(
    "compute_deadline",
    {
      title: "Compute a filing deadline under the Rules of Court",
      description:
        "Deterministic filing-deadline calculator under the Rules of Court. Applies Rule 22 computation of " +
        "time (exclude the first day, include the last; last day on a Saturday, Sunday, or legal holiday runs " +
        "to the next working day) to the common reglementary periods (Rule 37, Rule 41, Rule 45, Rule 65). " +
        "Pass legal holidays as ISO dates — they are declared per year by proclamation, so never assume the " +
        "calendar. Verify the rule text with get_provision or cite_validate before relying on it. Not legal advice.",
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
      const period = PERIODS[args.filingType];
      const start = parseIso(args.noticeDate);
      if (!start) {
        return textResult({
          status: "invalid_date",
          message: "noticeDate must be an ISO date (YYYY-MM-DD).",
          lastDay: null,
        });
      }

      const holidays = new Set(args.holidays ?? []);
      for (const h of args.holidays ?? []) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(h)) {
          return textResult({
            status: "invalid_date",
            message: `holidays entries must be ISO dates (YYYY-MM-DD): ${h}`,
            lastDay: null,
          });
        }
      }

      // Rule 45 §2 is the only period with an allowed extension (max 30 days);
      // extensionDays is intentionally ignored for other filing types.
      const extension = args.filingType === "appeal_certiorari_sc" ? (args.extensionDays ?? 0) : 0;
      const totalDays = period.days + Math.min(extension, 30);
      const lastDay = lastWorkingDay(start, totalDays, holidays);

      return textResult({
        status: "ok",
        filingType: args.filingType,
        rule: period.rule,
        baseDays: period.days,
        extensionDays: extension,
        totalDays,
        note: period.note,
        rule22:
          "Rule 22, Sec. 1 — the day of the act/event from which the period begins is excluded, the date of " +
          "performance included; if the last day falls on a Saturday, Sunday, or legal holiday, time runs until " +
          "the next working day.",
        lastDay: toIso(lastDay),
      });
    },
  );
}
