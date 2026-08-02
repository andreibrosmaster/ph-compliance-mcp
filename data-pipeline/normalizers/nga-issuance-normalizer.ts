/**
 * Generic NGA/LGU/GOCC issuance normalizer (ADR-004 compliance expansion).
 * Turns a raw government issuance document — National Government Agency
 * memorandum/circular, Local Government Unit ordinance/resolution, or
 * Government-Owned and Controlled Corporation issuance — into an
 * IssuanceRecord. Agency is detected from the document header; the type is
 * matched against a broad registry of PH issuance forms.
 *
 * Typical headers:
 *   "DEPARTMENT OF LABOR AND EMPLOYMENT / DEPARTMENT ORDER NO. 223-18" (DOLE)
 *   "MEMORANDUM CIRCULAR NO. 2023-05" (CSC/DBM)
 *   "ORDINANCE NO. 2023-123" / "RESOLUTION NO. 2023-45" (LGU)
 *   "SOCIAL SECURITY SYSTEM / CIRCULAR NO. 2023-01" (GOCC)
 *   "ADVISORY ..." / "GUIDELINES ..."
 */
import { chunkIntoPassages } from "../chunkers/passage-chunker.js";
import type { IssuanceRecord, PassageRecord, RawDocument } from "../types.js";
import { normalizeWhitespace, parseDate, sha256 } from "./statute-normalizer.js";

export interface NgaNormalizeOptions {
  /** Override detected agency (e.g. "DOLE"). */
  agency?: string;
  /** Override detected type. */
  issuanceType?: string;
  /** Override detected reference number. */
  referenceNo?: string;
  /** ISO date override. */
  issueDate?: string;
  /** Override detected title. */
  title?: string;
}

/** Broad registry of Philippine government issuance forms. */
const TYPE_PATTERNS: Array<{ type: string; re: RegExp }> = [
  { type: "Department Order", re: /^(?:DEPARTMENT\s+)?ORDER\s+(?:NO\.?\s*)?([0-9]+(?:-[0-9]{2,4})?)\b/i },
  { type: "Memorandum Circular", re: /^MEMORANDUM\s+CIRCULAR\s+(?:NO\.?\s*)?([0-9]+(?:-[0-9]{2,4})?)\b/i },
  { type: "Memorandum Order", re: /^MEMORANDUM\s+ORDER\s+(?:NO\.?\s*)?([0-9]+(?:-[0-9]{2,4})?)\b/i },
  { type: "Circular", re: /^CIRCULAR\s+(?:NO\.?\s*)?([0-9]+(?:-[0-9]{2,4})?)\b/i },
  { type: "Ordinance", re: /^ORDINANCE\s+(?:NO\.?\s*)?([0-9]+(?:-[0-9]{2,4})?)\b/i },
  { type: "Resolution", re: /^RESOLUTION\s+(?:NO\.?\s*)?([0-9]+(?:-[0-9]{2,4})?)\b/i },
  { type: "Advisory", re: /^ADVISORY\s+(?:NO\.?\s*)?([0-9]+(?:-[0-9]{2,4})?)?\b/i },
  { type: "Guidelines", re: /^GUIDELINES\s+(?:ON|FOR|IN|NO\.?\s*)?\b/i },
];

/**
 * Agency hints keyed by keyword found in the header/first lines.
 * Acronyms are word-boundary anchored (\b) so a hint like "SEC" cannot match
 * inside a longer word such as "SECURITY" — otherwise "SOCIAL SECURITY
 * SYSTEM" would misdetect as the SEC instead of the SSS.
 */
const AGENCY_HINTS: Array<{ name: string; re: RegExp }> = [
  { name: "DOLE", re: /DEPARTMENT\s+OF\s+LABOR|\bDOLE\b/i },
  { name: "DTI", re: /DEPARTMENT\s+OF\s+TRADE|\bDTI\b/i },
  { name: "CSC", re: /CIVIL\s+SERVICE\s+COMMISSION|\bCSC\b/i },
  { name: "DBM", re: /DEPARTMENT\s+OF\s+BUDGET|\bDBM\b/i },
  { name: "COA", re: /COMMISSION\s+ON\s+AUDIT|\bCOA\b/i },
  { name: "DENR", re: /DEPARTMENT\s+OF\s+ENVIRONMENT|\bDENR\b/i },
  { name: "DOF", re: /DEPARTMENT\s+OF\s+FINANCE|\bDOF\b/i },
  { name: "SEC", re: /SECURITIES\s+AND\s+EXCHANGE|\bSEC\b/i },
  { name: "GSIS", re: /GOVERNMENT\s+SERVICE\s+INSURANCE|\bGSIS\b/i },
  { name: "SSS", re: /SOCIAL\s+SECURITY\s+SYSTEM|\bSSS\b/i },
  { name: "PhilHealth", re: /PHILHEALTH/i },
  { name: "Pag-IBIG", re: /PAG[-\s]?IBIG/i },
  { name: "BSP", re: /BANGKO\s+SENTRAL|\bBSP\b/i },
  { name: "DOJ", re: /DEPARTMENT\s+OF\s+JUSTICE|\bDOJ\b/i },
  { name: "DICT", re: /DEPARTMENT\s+OF\s+INFORMATION|\bDICT\b/i },
];

export function normalizeNgaIssuance(
  doc: RawDocument,
  opts: NgaNormalizeOptions = {},
): IssuanceRecord {
  const text = normalizeWhitespace(doc.text);
  const lines = text.split("\n").map((l) => l.trim()).filter((l) => l.length > 0);
  const header = lines.slice(0, 8).join("\n");

  let issuanceType = opts.issuanceType;
  let referenceNo = opts.referenceNo;
  let matchedLine = "";

  for (const line of lines.slice(0, 8)) {
    for (const { type, re } of TYPE_PATTERNS) {
      const m = re.exec(line);
      if (m) {
        issuanceType = issuanceType ?? type;
        referenceNo = referenceNo ?? `${type} ${m[1] ?? ""}`.trim();
        matchedLine = line;
        break;
      }
    }
    if (matchedLine) break;
  }

  // Agency: explicit override first, then header keyword detection.
  let agency = opts.agency;
  if (!agency) {
    const hit = AGENCY_HINTS.find((h) => h.re.test(header));
    if (hit) agency = hit.name;
  }
  agency = agency ?? "National Government Agency";

  // Title: SUBJECT:/RE:/TITLE: line or the first non-heading line.
  let title = opts.title;
  if (!title) {
    const subject = lines.find((l) => /^(subject|re|title)\s*:/i.test(l));
    if (subject) {
      title = subject.replace(/^(subject|re|title)\s*:/i, "").trim();
    } else {
      const firstBodyLine = lines.find((l) => l !== matchedLine);
      if (firstBodyLine) title = firstBodyLine.slice(0, 200);
    }
  }

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
