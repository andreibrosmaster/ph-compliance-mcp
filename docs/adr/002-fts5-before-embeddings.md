# ADR-002: FTS5 Before Embeddings

- **Status:** Accepted
- **Date:** 2026-08-02

## Context

The v1 tech stack scheduled sqlite-vec, ONNX embeddings, and hybrid rank-fusion
into Phase 1–2 — before a single query had been proven useful with lexical search
alone. That couples a working tool to a long dependency chain and adds an entire
class of "why did retrieval quality regress" debugging surface.

## Decision

V1 ships **FTS5/BM25 lexical search only**: `src/retrieval/fts-search.ts` +
`src/retrieval/confidence.ts`. The embedding pipeline exists but is a no-op stub
until Phase 4/5, when `sqlite-vec`, local query embedding, and reciprocal-rank
fusion layer on **without changing the tool contract**.

## Consequences

- A working, useful tool ships before any vector work — the single biggest
  simplification vs. v1.
- The tool output contract is stable across retrieval-method upgrades.
- The eval harness must validate the lexical baseline before complexity is added.
- Revisit at Phase 4 kickoff: if lexical retrieval already meets quality gates,
  embeddings can be de-prioritized further.

## Alternatives considered

- Hybrid-from-day-one (rejected: long dependency chain before first useful query).
- Embeddings-only (rejected: no lexical baseline, harder to debug).
