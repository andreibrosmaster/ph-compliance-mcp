/**
 * Source adapter contract (production-readiness push, 0.7.0).
 *
 * Adapters turn an official source (Official Gazette, LawPhil, agency
 * repositories) into RawDocuments for the pipeline. They are CI-only, run by
 * `build-index.ts --sources <name,...>`, and never run at server runtime.
 *
 * An adapter is a function that, given the polite HTTP client, yields raw
 * documents. The heavy lifting (normalization, chunking, hashing) happens
 * downstream in the normalizers — adapters only fetch and identify.
 */
import type { HttpClient } from "../http-client.js";
import type { RawDocument } from "../types.js";
import { lawphilAdapter } from "./lawphil.js";
import { officialGazetteAdapter } from "./official-gazette.js";

export interface SourceAdapter {
  /** Stable id, e.g. "official-gazette". */
  id: string;
  /** Human-readable source name. */
  name: string;
  /** Canonical archive root. */
  baseUrl: string;
  /** Fetch documents. CI-only; must respect robots + throttle via HttpClient. */
  fetch: (client: HttpClient, opts: SourceFetchOptions) => AsyncGenerator<RawDocument>;
}

export interface SourceFetchOptions {
  /** Fetch only documents newer than this ISO date (ISO 8601). */
  since?: string;
  /** Max documents to fetch (defensive). */
  max?: number;
}

/** Registry of available source adapters. */
export const SOURCE_ADAPTERS: SourceAdapter[] = [officialGazetteAdapter, lawphilAdapter];

/** Look up an adapter by its stable id. */
export function adapterById(id: string): SourceAdapter | undefined {
  return SOURCE_ADAPTERS.find((a) => a.id === id);
}
