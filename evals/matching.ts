/**
 * Shared golden-set matching helpers (run-eval harness + drift test).
 *
 * The eval contract: an answer PASSES when the normalized answer appears in
 * the text retrieved by the plan's tool calls. Long answers use a plain
 * substring check; short answers use word/digit boundaries so "24" cannot
 * match inside "2024", and "250,000" still matches "P250,000" or "₱250,000"
 * (a preceding currency symbol is not a digit, so the lookbehind passes).
 */
export function normalize(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

export function answerMatches(text: string, answer: string): boolean {
  const haystack = normalize(text);
  const needle = normalize(answer);
  if (needle.length === 0) return false;
  if (needle.length >= 8) return haystack.includes(needle);
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (/\d/.test(needle)) {
    return new RegExp(`(?<![0-9])${escaped}(?![0-9])`).test(haystack);
  }
  return new RegExp(`\\b${escaped}\\b`).test(haystack);
}

/** Collect every text fragment from a CallToolResult (content + structured). */
export function collectText(result: {
  content?: Array<{ type: string; text?: string }>;
  structuredContent?: unknown;
}): string {
  const parts: string[] = [];
  for (const c of result.content ?? []) {
    if (c.type === "text" && c.text) parts.push(c.text);
  }
  if (result.structuredContent) parts.push(JSON.stringify(result.structuredContent));
  return parts.join("\n");
}
