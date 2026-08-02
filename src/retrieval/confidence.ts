/**
 * confidence (blueprint §10, constraint #1).
 *
 * Lexical-only confidence scoring for FTS5 results. Below the configured
 * threshold, tools return "insufficient corpus coverage" rather than a
 * low-quality top-1. Deterministic and easy to tune for the initial eval pass.
 */
import type { Config } from "../config.js";

export type ConfidenceLevel = "high" | "medium" | "low";

export interface Confidence {
  score: number; // 0..1
  level: ConfidenceLevel;
  reasons: string[];
}

interface MatchFeatures {
  /** BM25 rank as returned by SQLite (negative; higher = better). */
  bm25Score: number;
  /** Fraction of query terms matched by the hit. */
  termCoverage: number;
  /** Exact phrase containment of the query in the provision body. */
  exactPhrase: boolean;
  /** Heading matched the query exactly or near-exactly. */
  headingMatch: boolean;
}

/**
 * Map raw match features to a 0..1 confidence score.
 *
 * Rationale (keep tunable, do not over-engineer): BM25 gives a spread we
 * normalize via a saturating curve; term coverage and exact-phrase presence
 * anchor the top end; heading matches are weak positives.
 */
export function scoreConfidence(features: MatchFeatures): Confidence {
  const reasons: string[] = [];
  let score = 0;

  // BM25 normalization: saturating curve on -bm25 (typical values 0..15).
  const bm = Math.max(0, -features.bm25Score);
  score += 0.5 * (bm / (bm + 5));

  score += 0.3 * features.termCoverage;
  score += 0.2 * (features.exactPhrase ? 1 : 0);
  score += 0.05 * (features.headingMatch ? 1 : 0);

  score = Math.min(1, Math.max(0, score));

  if (features.exactPhrase) reasons.push("exact phrase present");
  if (features.headingMatch) reasons.push("heading match");
  if (features.termCoverage >= 0.99) reasons.push("full term coverage");

  let level: ConfidenceLevel = "low";
  if (score >= 0.7) level = "high";
  else if (score >= 0.4) level = "medium";

  return { score, level, reasons };
}

/** Should this result be served, given the configured threshold? */
export function passesGate(confidence: Confidence, config: Config): boolean {
  return confidence.score >= config.confidenceThreshold;
}

/** Parse the query into normalized terms (used for term coverage). */
export function queryTerms(query: string): string[] {
  return query
    .toLowerCase()
    .split(/\s+/)
    .map((t) => t.replace(/[^\p{L}\p{N}]+/gu, ""))
    .filter((t) => t.length > 0);
}
