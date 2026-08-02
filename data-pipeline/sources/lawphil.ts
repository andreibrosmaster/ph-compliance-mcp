/**
 * LawPhil source adapter (production-readiness push, 0.7.0).
 *
 * Fetches every catalogued instrument whose sourceUrl is on the LawPhil
 * domain (mirror archive for presidential decrees, acts, and older republic
 * acts), extracts the body, and yields RawDocuments. CI-only; respects
 * robots.txt + throttling via HttpClient. Never fabricates text.
 */
import type { HttpClient } from "../http-client.js";
import type { RawDocument } from "../types.js";
import { extractArticle, LAWPHIL_SELECTORS, MIN_TEXT_LENGTH } from "./extract.js";
import { catalogTargetsFor } from "./targets.js";
import type { SourceAdapter, SourceFetchOptions } from "./types.js";

export const LAWPHIL_BASE = "https://lawphil.net";

export const lawphilAdapter: SourceAdapter = {
  id: "lawphil",
  name: "LawPhil — Arellano Law Foundation",
  baseUrl: LAWPHIL_BASE,
  async *fetch(client: HttpClient, opts: SourceFetchOptions) {
    let fetched = 0;
    for (const entry of catalogTargetsFor(LAWPHIL_BASE)) {
      if (opts.since && entry.enactedDate && entry.enactedDate < opts.since) continue;
      if (opts.max !== undefined && fetched >= opts.max) break;

      const res = await client.get(entry.sourceUrl);
      const { title, text } = extractArticle(res.text, LAWPHIL_SELECTORS);
      if (text.trim().length < MIN_TEXT_LENGTH) {
        console.warn(`[lawphil] skipping thin page (${text.trim().length} chars): ${entry.sourceUrl}`);
        continue;
      }
      fetched++;
      yield {
        sourceUrl: entry.sourceUrl,
        retrievedAt: new Date().toISOString(),
        title: title ?? entry.shortTitle,
        text,
        rawHash: res.contentHash,
      } satisfies RawDocument;
    }
  },
};
