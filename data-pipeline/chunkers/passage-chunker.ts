/**
 * Passage chunker for case decisions and issuances: splits long free-form
 * text into numbered passages on paragraph boundaries (no mid-sentence cuts),
 * bounded by maxChars per passage.
 */
import { normalizeWhitespace } from "../normalizers/statute-normalizer.js";
import type { PassageRecord } from "../types.ts";

export interface ChunkOptions {
  maxChars?: number;
}

const DEFAULT_MAX_CHARS = 2000;

/** Split text into paragraphs, then pack them into passages. */
export function chunkIntoPassages(text: string, opts: ChunkOptions = {}): PassageRecord[] {
  const maxChars = opts.maxChars ?? DEFAULT_MAX_CHARS;
  const normalized = normalizeWhitespace(text);
  if (!normalized) return [];

  const paragraphs = normalized.split("\n\n").filter((p) => p.trim().length > 0);
  const passages: PassageRecord[] = [];
  let current: string[] = [];
  let currentLen = 0;

  const flush = () => {
    if (current.length === 0) return;
    passages.push({
      passageNo: passages.length + 1,
      body: current.join("\n\n"),
    });
    current = [];
    currentLen = 0;
  };

  for (const para of paragraphs) {
    if (currentLen + para.length + 2 > maxChars && current.length > 0) {
      flush();
    }
    // A single paragraph longer than maxChars must still be split (rare).
    if (para.length > maxChars) {
      flush();
      let remaining = para;
      while (remaining.length > maxChars) {
        // Cut at the last sentence-ish boundary within the limit.
        let cut = maxChars;
        const lastSentence = remaining.lastIndexOf(". ", maxChars);
        const lastSpace = remaining.lastIndexOf(" ", maxChars);
        if (lastSentence > maxChars * 0.6) cut = lastSentence + 1;
        else if (lastSpace > maxChars * 0.6) cut = lastSpace;
        passages.push({
          passageNo: passages.length + 1,
          body: remaining.slice(0, cut).trim(),
        });
        remaining = remaining.slice(cut).trim();
      }
      if (remaining) {
        current = [remaining];
        currentLen = remaining.length;
      }
      continue;
    }
    current.push(para);
    currentLen += para.length + 2;
  }
  flush();
  return passages;
}
