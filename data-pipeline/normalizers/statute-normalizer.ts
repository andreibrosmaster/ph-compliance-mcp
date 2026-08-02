/**
 * Statute normalizer: splits raw statute text into provisions
 * (provision_no / heading / body) and computes content hashes (constraint #5).
 *
 * The split is deliberately conservative: it recognizes codal-style headings
 * ("Art. 1.", "Article 1", "SECTION 1.", "Sec. 2") and keeps everything up to
 * the next heading as body. The heading line's own text is kept in BOTH the
 * structured `heading` field and the start of `body`, so no codal text is ever
 * dropped from the searchable/citable body.
 */
import { createHash } from "node:crypto";
import type { ProvisionRecord, RawDocument, StatuteRecord } from "../types.js";

export interface NormalizeOptions {
  shortTitle: string;
  officialTitle: string;
  kind: StatuteRecord["kind"];
  domain: string;
  enactedDate?: string;
}

/** Heading regexes in priority order (lower index = tried first). */
const HEADING_PATTERNS: Array<{ re: RegExp }> = [
  { re: /^(?:ARTICLE|ART\.?)\s+([IVXLCDM]+|[0-9]+)\.?\s*(.*)$/i },
  { re: /^(?:SECTION|SEC\.?)\s+([0-9]+)\.?\s*(.*)$/i },
];

/** Normalize whitespace: collapse runs, keep paragraph breaks as \n\n. */
export function normalizeWhitespace(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n") // trailing whitespace before a newline
    .replace(/\n[ \t]+/g, "\n") // leading whitespace after a newline
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/^[ \t]+/gm, "") // line-leading indentation (continuation lines)
    .trim();
}

/** SHA-256 hex digest of a string (provenance, constraint #5). Shared by
 * all normalizers. */
export function sha256(data: string): string {
  return createHash("sha256").update(data).digest("hex");
}

/** First ISO date (YYYY-MM-DD) found in text, or undefined. */
export function parseDate(text: string): string | undefined {
  const m = /(\d{4})-(\d{2})-(\d{2})/.exec(text);
  if (!m) return undefined;
  return `${m[1]}-${m[2]}-${m[3]}`;
}

/** Split normalized text into {number, heading, body} blocks. */
export function segmentProvisions(text: string): Array<{
  number: string;
  heading: string;
  body: string;
}> {
  const blocks: Array<{ number: string; heading: string; body: string }> = [];
  let current: { number: string; heading: string; body: string } | null = null;
  let buffer: string[] = [];

  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    let matched: { number: string; heading: string } | null = null;

    for (const { re } of HEADING_PATTERNS) {
      const m = re.exec(trimmed);
      if (m) {
        matched = { number: m[1]!.toUpperCase(), heading: (m[2] ?? "").trim() };
        break;
      }
    }

    if (matched) {
      if (current) {
        current.body = buffer.join("\n").trim();
        blocks.push(current);
      }
      current = { number: matched.number, heading: matched.heading, body: "" };
      // Keep the heading line's text as the first body line so no text is lost.
      buffer = matched.heading ? [matched.heading] : [];
    } else if (current) {
      buffer.push(trimmed);
    }
    // Lines before the first heading are dropped (title/header material).
  }

  if (current) {
    current.body = buffer.join("\n").trim();
    blocks.push(current);
  }
  return blocks.filter((b) => b.body.length > 0 || b.heading.length > 0);
}

/** Build a StatuteRecord from a raw document and metadata. */
export function normalizeStatute(
  doc: RawDocument,
  opts: NormalizeOptions,
): StatuteRecord {
  const text = normalizeWhitespace(doc.text);
  const blocks = segmentProvisions(text);

  const provisions: ProvisionRecord[] = blocks.map((b) => ({
    provisionNo: b.number,
    heading: b.heading || undefined,
    body: b.body,
    validFrom: undefined,
  }));

  // Content hash covers the whole normalized text (provenance, constraint #5).
  const contentHash = sha256(text);
  return {
    sourceUrl: doc.sourceUrl,
    retrievedAt: doc.retrievedAt,
    contentHash,
    shortTitle: opts.shortTitle,
    officialTitle: opts.officialTitle,
    kind: opts.kind,
    domain: opts.domain,
    enactedDate: opts.enactedDate,
    provisions,
  };
}
