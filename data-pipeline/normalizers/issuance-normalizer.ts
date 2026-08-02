/**
 * Issuance normalizer (Phase 3 — BIR first). Turns a raw BIR issuance document
 * (Revenue Regulations, Revenue Memorandum Circulars, etc.) into an
 * IssuanceRecord: extracts agency/type/reference number, derives a title,
 * chunks the body into passages, and hashes the normalized text (constraint #5).
 *
 * BIR issuance format (typical first lines):
 *   "REVENUE MEMORANDUM CIRCULAR NO. 85-2023" / "RR 8-2018"
 *   "SUBJECT: ..." / a descriptive title line
 *   then the body.
 */
import { chunkIntoPassages } from "../chunkers/passage-chunker.js";
import type { IssuanceRecord, PassageRecord, RawDocument } from "../types.js";
import { normalizeWhitespace, parseDate, sha256 } from "./statute-normalizer.js";

export interface IssuanceNormalizeOptions {
  /** Defaults to "BIR". */
  agency?: string;
  /** Override detected type (e.g. "Revenue Regulations"). */
  issuanceType?: string;
  /** Override detected reference number (e.g. "RMC 85-2023"). */
  referenceNo?: string;
  /** ISO date override. */
  issueDate?: string;
  /** Override detected title. */
  title?: string;
}

/** Regexes that recognize a BIR issuance type + number on a heading line. */
const TYPE_PATTERNS: Array<{ type: string; re: RegExp }> = [
  { type: "Revenue Regulations", re: /^(?:REVENUE\s+)?REGULATIONS?\s+(?:NO\.?\s*)?([0-9]+-[0-9]{4})\b/i },
  {
    type: "Revenue Memorandum Circular",
    re: /^REVENUE\s+MEMORANDUM\s+CIRCULAR\s+(?:NO\.?\s*)?([0-9]+-[0-9]{4})\b/i,
  },
  { type: "Revenue Memorandum Order", re: /^REVENUE\s+MEMORANDUM\s+ORDER\s+(?:NO\.?\s*)?([0-9]+-[0-9]{4})\b/i },
  { type: "Revenue Memorandum Ruling", re: /^REVENUE\s+MEMORANDUM\s+RULING\s+(?:NO\.?\s*)?([0-9]+-[0-9]{4})\b/i },
];

/** Reference-number prefix per issuance type (e.g. "RMC 85-2023"). */
const REF_NO_PREFIX: Record<string, string> = {
  "Revenue Regulations": "RR",
  "Revenue Memorandum Circular": "RMC",
  "Revenue Memorandum Order": "RMO",
  "Revenue Memorandum Ruling": "RMR",
};

export function normalizeIssuance(
  doc: RawDocument,
  opts: IssuanceNormalizeOptions = {},
): IssuanceRecord {
  const text = normalizeWhitespace(doc.text);
  const lines = text.split("\n").map((l) => l.trim()).filter((l) => l.length > 0);

  let issuanceType = opts.issuanceType;
  let referenceNo = opts.referenceNo;
  let matchedLine = "";

  // Detect type + reference from the first lines (BIR header style).
  for (const line of lines.slice(0, 6)) {
    for (const { type, re } of TYPE_PATTERNS) {
      const m = re.exec(line);
      if (m) {
        issuanceType = issuanceType ?? type;
        referenceNo = referenceNo ?? `${REF_NO_PREFIX[type] ?? "ISS"} ${m[1]}`;
        matchedLine = line;
        break;
      }
    }
    if (matchedLine) break;
  }

  // Title: the SUBJECT: line or the first non-heading line.
  let title = opts.title;
  if (!title) {
    const subject = lines.find((l) => /^(subject|re)\s*:/i.test(l));
    if (subject) {
      title = subject.replace(/^(subject|re)\s*:/i, "").trim();
    } else {
      const firstBodyLine = lines.find((l) => l !== matchedLine);
      if (firstBodyLine) title = firstBodyLine.slice(0, 200);
    }
  }

  const agency = opts.agency ?? "BIR";
  const issueDate = opts.issueDate ?? parseDate(text);

  const passages: PassageRecord[] = chunkIntoPassages(text, { maxChars: 2500 });

  return {
    sourceUrl: doc.sourceUrl,
    retrievedAt: doc.retrievedAt,
    contentHash: sha256(text),
    agency,
    issuanceType: issuanceType ?? "Other Issuance",
    referenceNo: referenceNo ?? "UNKNOWN",
    title,
    issueDate,
    passages,
  };
}
