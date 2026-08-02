# Architecture

High-level view of `ph-compliance-mcp`, the Philippine Legal & Compliance MCP
(blueprint §5–§6; ADR-004). This is the target architecture; layers land phase
by phase (see [`../second-brain/roadmap.md`](../second-brain/roadmap.md)).

## Layers

```
┌─────────────────────────────────────────────────────────────────┐
│  1. INGESTION LAYER  (data-pipeline/, CI-only, never at runtime)│
│     scrapers → normalizers → chunkers → SQLite build            │
│     (embedding step exists but is a no-op / stub until Phase 5) │
└───────────────────────────┬─────────────────────────────────────┘
                             │ produces laws.sqlite, cases.sqlite,
                             │ issuances.sqlite (Release assets)
┌───────────────────────────▼─────────────────────────────────────┐
│  2. STORAGE LAYER                                                │
│     3 SQLite files, each with relational tables + FTS5           │
│     (embeddings.sqlite added Phase 5, ATTACHed at query time)   │
└───────────────────────────┬─────────────────────────────────────┘
┌───────────────────────────▼─────────────────────────────────────┐
│  3. RETRIEVAL LAYER  (src/retrieval/)                            │
│     V1: FTS5/BM25 only → confidence scoring → citation resolve  │
│     V2 (Phase 5): + vector search, hybrid rank fusion            │
└───────────────────────────┬─────────────────────────────────────┘
┌───────────────────────────▼─────────────────────────────────────┐
│  4. MCP TOOL LAYER  (src/tools/, src/resources/)                 │
│     domain-scoped tools, citation-validation tool,               │
│     graph tools added Phase 4 (related_laws, show_amendments...) │
└───────────────────────────┬─────────────────────────────────────┘
                             │ stdio (JSON-RPC over stdin/stdout)
┌───────────────────────────▼─────────────────────────────────────┐
│  5. AGENT CLIENTS — Claude Code · OpenCode · Cline · Claude.ai  │
└─────────────────────────────────────────────────────────────────┘
```

Key property: **Layer 3 has a real, working V1 (FTS5 only)** that ships before
the vector/hybrid layer exists (ADR-002). The tool contract in Layer 4 does not
change when retrieval underneath improves.

## Tech stack (V1)

| Concern | Choice | Note |
|---|---|---|
| Language/runtime | TypeScript, Node.js 24 LTS | |
| MCP SDK | `@modelcontextprotocol/sdk` (stable v1 line) | re-verify version at Phase 2 kickoff |
| Package manager | pnpm | |
| Storage | SQLite via `better-sqlite3`, 3 files | laws / cases / issuances (ADR-003) |
| Search (V1) | SQLite FTS5 only | no vector dependency (ADR-002) |
| Search (Phase 5) | + sqlite-vec, local embedding, rank fusion | only after lexical baseline validated |
| HTML/PDF parsing | cheerio, pdf-parse/pdfjs-dist | ingestion-only |
| Validation | zod | schema = docs = one source of truth |
| Testing | vitest | |
| Linting | eslint (flat) + prettier + `scripts/check-loc-budget.mjs` | warn >220 LOC, flag >350 |
| CI/CD | GitHub Actions | ci, refresh-corpus, release |
| Corpus integrity | SHA-256 checksum per Release asset; verified on load | refused loudly on mismatch |

## Data flow

1. CI pipeline scrapes primary sources (Official Gazette, LawPhil, SC E-Library,
   Chan Robles cross-check, BIR archive) with conditional GETs and low concurrency.
2. Normalizers/chunkers produce versioned provision/passage records with provenance
   (URL, retrieval date, content hash).
3. `build-index.ts` writes `laws.sqlite` + `cases.sqlite` (+ `issuances.sqlite`
   from Phase 3), populating FTS5 external-content tables.
4. Assets + `.sha256` files publish to GitHub Releases.
5. `corpus-loader.ts` downloads, verifies checksums, caches locally, and ATTACHes
   all three DBs at query time.
6. `fts-search.ts` → `confidence.ts` → citation resolution answer tools; below
   confidence threshold the tool refuses rather than guesses.
