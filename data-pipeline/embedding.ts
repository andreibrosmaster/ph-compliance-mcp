/**
 * Embedding no-op stub (ADR-002: FTS5 before embeddings).
 *
 * The pipeline calls `embedText` during a build, but until Phase 4/5 this
 * returns immediately and stores nothing. When vector search lands, this is
 * where transformers.js query/provision embeddings get computed and written
 * into the 4th ATTACHed file (embeddings.sqlite).
 */
export interface EmbeddingResult {
  vector?: number[];
  dimension: number;
  stored: boolean;
}

/** No-op until Phase 4/5. Always resolves immediately. */
export async function embedText(_text: string): Promise<EmbeddingResult> {
  return { dimension: 0, stored: false };
}

/** Marker the build can check to confirm the stub is active. */
export const EMBEDDINGS_ACTIVE = false;
