# ADR-001: SQLite, Not Postgres

- **Status:** Accepted
- **Date:** 2026-08-02

## Context

Distribution model: a local stdio-transport MCP server, installed via
`npx github:<owner>/<repo>`. No hosted server, no auth layer, no network
exposure. The corpus is read-heavy, written only during CI builds. Single
maintainer, pre-MVP.

## Decision

SQLite via `better-sqlite3`. Three files: `laws.sqlite`, `cases.sqlite`,
`issuances.sqlite` (see ADR-003). `embeddings.sqlite` is added in Phase 4/5 and
attached at query time via `ATTACH DATABASE`.

## Consequences

- Zero-ops: the database ships as a GitHub Release asset, downloaded and cached locally.
- Multi-file queries via ATTACH; per-file versioning per blueprint §15.
- No server process, no connection pool, no deployment surface.
- Write contention is a non-issue (single writer in CI).
- Postgres would add a hosting/ops burden with zero benefit for a local stdio tool.

## Alternatives considered

- Postgres (rejected: hosting/ops burden; contradicts the pure-GitHub distribution model).
- Five-file split per external recommendation (rejected in ADR-003: multiplies loader logic).
