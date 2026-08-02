# ADR-003: Three Corpus Files, Not Five

- **Status:** Accepted
- **Date:** 2026-08-02

## Context

An external recommendation proposed five separate corpora. Each split multiplies
the corpus-loader's download/cache/integrity-check logic. Versioning needs are
per-domain-cadence: the tax corpus refreshes weekly, the Constitution
effectively never.

## Decision

Three files: `laws.sqlite`, `cases.sqlite`, `issuances.sqlite`.
`issuances.sqlite` stays empty/unused until Phase 3. When embeddings arrive
(Phase 4/5), they live in a fourth file, `embeddings.sqlite`, attached at query
time — not because five files is wrong in principle, but because a
`knowledge.sqlite` with no defined schema yet is premature.

## Consequences

- 3x download/cache/checksum logic instead of 5x.
- Independent per-file version stamps: `laws-2026.08.15`, `cases-2026.08.12`,
  `issuances-2026.08.20` (blueprint §15).
- Smaller per-file downloads; independent refresh cadences.
- Revisit the split when a real schema for a 4th/5th corpus exists — not before.

## Alternatives considered

- Five-file split per external recommendation (rejected: multiplies loader
  logic before the 4th/5th corpus has a defined schema).
