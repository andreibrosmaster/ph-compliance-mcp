/**
 * Official Gazette source adapter (production-readiness push, 0.7.0).
 *
 * Fetches every catalogued instrument whose sourceUrl is on the Official
 * Gazette domain, extracts the article body, and yields RawDocuments for the
 * pipeline. Runs only under `build-index.ts --sources official-gazette` (CI);
 * respects robots.txt + throttling via HttpClient. Never fabricates text.
 */
import type { HttpClient } from "../http-client.js";
import type { RawDocument } from "../types.js";
import { extractArticle, MIN_TEXT_LENGTH, OG_SELECTORS } from "./extract.js";
import { catalogTargetsFor } from "./targets.js";
import type { SourceAdapter, SourceFetchOptions } from "./types.js";

export const OFFICIAL_GAZETTE_BASE = "https://www.officialgazette.gov.ph";

export const officialGazetteAdapter: SourceAdapter = {
  id: "official-gazette",
  name: "Official Gazette of the Republic of the Philippines",
  baseUrl: OFFICIAL_GAZETTE_BASE,
  async *fetch(client: HttpClient, opts: SourceFetchOptions) {
    let fetched = 0;
    for (const entry of catalogTargetsFor(OFFICIAL_GAZETTE_BASE)) {
      if (opts.since && entry.enactedDate && entry.enactedDate < opts.since) continue;
      if (opts.max !== undefined && fetched >= opts.max) break;

      const res = await client.get(entry.sourceUrl);
      const { title, text } = extractArticle(res.text, OG_SELECTORS);
      if (text.trim().length < MIN_TEXT_LENGTH) {
        console.warn(`[official-gazette] skipping thin page (${text.trim().length} chars): ${entry.sourceUrl}`);
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
