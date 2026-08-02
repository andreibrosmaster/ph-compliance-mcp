/**
 * Citation extractor (Phase 4, jurisprudence graph). Pure, regex-based
 * extraction of Philippine legal citation spans from corpus text — no DB
 * access, so it is fully unit-testable. Resolution against the corpus happens
 * in `resolver.ts`; only citations that RESOLVE are recorded as graph edges
 * (constraint #1 — never a best-effort guess).
 *
 * Recognized canonical PH formats (Supreme Court stylebook / UP Law Center
 * citation conventions, verified for this implementation):
 *   - Case:       G.R. No. 238875 | G.R. No. L-12345
 *   - Statute:    RA 386 | Republic Act No. 386 | PD 442 | EO 292
 *   - Provision:  Art. 1156, Civil Code | Art. 1156 of the Civil Code
 *                 | Sec. 5(b) of Republic Act No. 9165 | Art. 266-A, RPC
 *   - Constitution: Art. VIII, Sec. 13 of the 1987 Constitution
 *   - IRR:        IRR of RA 10173 | the IRR of Republic Act No. 10173
 */
import type { CitationSpan } from "../types.js";

export interface ExtractOptions {
  /** Maximum spans to return (defensive; case decisions cite heavily). */
  maxSpans?: number;
}

const DEFAULT_MAX_SPANS = 200;

/** G.R. case citations: modern (238875) and pre-1990s (L-12345). */
const CASE_RE = /\bG\.R\.\s*No\.\s*(L?-?\d+)\b/gi;

/** Statute act numbers: RA 386, Republic Act No. 386, PD 442, EO 292. */
const ACT_RE = /\b(?:Republic\s+Act|R\.?\s*A\.?|Presidential\s+Decree|P\.?\s*D\.?|Executive\s+Order|E\.?\s*O\.?|Batas\s+Pambansa|B\.?\s*P\.?|Commonwealth\s+Act|C\.?\s*A\.?|Act\s+No\.?)\s*(?:No\.?\s*)?(\d+)\b/gi;

/** Provision-level citations: Art./Sec. + number, optionally with a statute. */
// The title capture is LAZY and stops at a sentence end or a list separator
// (", and", " and Art.", etc.) so multi-citation sentences like "Art. 1156,
// Civil Code and Art. 5, Civil Code" yield SEPARATE spans instead of one
// span whose title swallows the rest of the sentence (which could never
// resolve against the corpus).
//
// The sentence-end alternative requires a period that is a REAL sentence end
// (end of text or followed by a capital letter) — an abbreviation period such
// as the one in "Republic Act No. 9165" (period followed by a digit) must NOT
// terminate the title.
const PROVISION_RE =
  /\b(?:Art(?:icle)?\.?|Sec(?:tion)?\.?)\s*([0-9]+(?:-[A-Za-z0-9]+)?(?:\([A-Za-z0-9]+\))?)\s*(?:,\s*|\s+of\s+)(?:the\s+)?([A-Z][A-Za-z0-9 ,.'-]{2,80}?)(?=\s*(?:\.(?=\s*(?:$|[A-Z]))|$|,\s*and\b|\s+and\s+(?:Art(?:icle)?|Sec(?:tion)?|G\.R\.|R\.?\s*A\.?|Republic|Presidential|Executive|Batas|Commonwealth|Act)\b))/gi;

/**
 * Act number embedded in a title hint, e.g. 'Republic Act No. 9165' → '9165'.
 * Lets "Sec. 5(b) of RA 9165" resolve by act number even when the citing text
 * never names the act number in isolation.
 */
const ACT_IN_TITLE_RE =
  /\b(?:Republic\s+Act|R\.?\s*A\.?|Presidential\s+Decree|P\.?\s*D\.?|Executive\s+Order|E\.?\s*O\.?|Batas\s+Pambansa|B\.?\s*P\.?|Commonwealth\s+Act|C\.?\s*A\.?)\s*(?:No\.?\s*)?(\d+)\b/i;

/** Constitution citations: "Art. VIII, Sec. 13 of the 1987 Constitution". */
const CONSTITUTION_RE =
  /\b(?:Art(?:icle)?\.?)\s*([IVXLCDM]+)\s*,\s*(?:Sec(?:tion)?\.?)\s*([0-9]+(?:\s*\([0-9]+\))?)\s*(?:of\s+)?(?:the\s+)?1987\s+Constitution\b/gi;

/** IRR references: "IRR of RA 10173", "the IRR of Republic Act No. 10173". */
const IRR_RE =
  /\b(?:the\s+)?(?:Revised\s+)?(?:Implementing\s+Rules(?:\s+and\s+Regulations)?|IRR)\s+of\s+(?:the\s+)?(?:RA|Republic\s+Act|R\.?\s*A\.?)\s*(?:No\.?\s*)?(\d+)\b/gi;

/** Known code short titles for title-hint normalization. */
const CODE_TITLES = new Set([
  "Civil Code",
  "Civil Code of the Philippines",
  "Revised Penal Code",
  "Family Code",
  "Labor Code",
  "National Internal Revenue Code",
  "Local Government Code",
  "Corporation Code",
  "Administrative Code",
  "Rules of Court",
]);

/** Normalize a title hint to a canonical short-title fragment for matching. */
export function normalizeTitleHint(hint: string): string | null {
  const t = hint.trim().replace(/^the\s+/i, "").replace(/[.,;]+$/g, "").trim();
  if (!t) return null;
  // Exact known code titles win; otherwise return the cleaned phrase.
  if (CODE_TITLES.has(t)) return t;
  if (CODE_TITLES.has(`${t} of the Philippines`)) return `${t} of the Philippines`;
  return t;
}

/** Extract citation spans from text. Deterministic; no side effects. */
export function extractCitations(text: string, opts: ExtractOptions = {}): CitationSpan[] {
  const maxSpans = opts.maxSpans ?? DEFAULT_MAX_SPANS;
  const spans: CitationSpan[] = [];

  // Cases first (most specific).
  for (const m of text.matchAll(CASE_RE)) {
    const raw = m[0];
    if (spans.some((s) => s.raw === raw)) continue;
    spans.push({
      kind: "case",
      raw,
      caseCitation: m[1]!.toUpperCase().startsWith("L-")
        ? `G.R. No. L-${m[1]!.slice(2)}`
        : `G.R. No. ${m[1]}`,
    });
    if (spans.length >= maxSpans) return spans;
  }

  // Constitution: "Art. VIII, Sec. 13 of the 1987 Constitution" → statute title + provision.
  for (const m of text.matchAll(CONSTITUTION_RE)) {
    const raw = m[0];
    if (spans.some((s) => s.raw === raw)) continue;
    spans.push({
      kind: "statute",
      raw,
      statuteTitle: "1987 Constitution",
      provisionNo: `${m[1]}-${m[2]}`,
    });
    if (spans.length >= maxSpans) return spans;
  }

  // Provision-level: "Art. 1156, Civil Code" / "Sec. 5(b) of RA 9165".
  for (const m of text.matchAll(PROVISION_RE)) {
    const raw = m[0];
    if (spans.some((s) => s.raw === raw)) continue;
    const hint = normalizeTitleHint(m[2] ?? "");
    if (!hint) continue;
    // "Sec. 5(b) of Republic Act No. 9165" carries the act number in its title
    // hint — lift it so the resolver can match by act_number directly.
    const actInTitle = hint.match(ACT_IN_TITLE_RE)?.[1];
    spans.push({
      kind: "statute",
      raw,
      actNumber: actInTitle,
      provisionNo: m[1]!.toUpperCase(),
      statuteTitle: hint,
    });
    if (spans.length >= maxSpans) return spans;
  }

  // IRR references → the implementing statute's act number.
  for (const m of text.matchAll(IRR_RE)) {
    const raw = m[0];
    if (spans.some((s) => s.raw === raw)) continue;
    spans.push({
      kind: "statute",
      raw,
      actNumber: m[1]!,
      statuteTitle: `IRR of RA ${m[1]}`,
    });
    if (spans.length >= maxSpans) return spans;
  }

  // Bare act numbers last (least specific).
  for (const m of text.matchAll(ACT_RE)) {
    const raw = m[0];
    if (spans.some((s) => s.raw === raw)) continue;
    spans.push({
      kind: "statute",
      raw,
      actNumber: m[1]!,
    });
    if (spans.length >= maxSpans) return spans;
  }

  return spans;
}
