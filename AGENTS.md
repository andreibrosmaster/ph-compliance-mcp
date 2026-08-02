# AGENTS.md — Working In This Repo

This project is executed **by agents** (Claude Code / OpenCode / Cline) under a
SCAN → AUDIT → PLAN → CONFIRM → IMPLEMENT → VERIFY → DOCUMENT loop. This file is
the operating manual.

## Read first

- `../second-brain/state.md` — current state and next actions (single source of truth)
- `../second-brain/roadmap.md` — phase checkboxes
- `docs/adr/` — decisions, before re-deciding something
- `llms.txt` + `docs/seo.md` — the public identity and GEO surface; keep them in sync

## Rules

1. **One phase at a time.** Hand an agent one phase's task block plus the
   sections it depends on — never the whole blueprint at once.
1b. **Git attribution is the user, never the AI tool.** Commit author and
   committer are `andreibrosmaster <andreibrosmaster@users.noreply.github.com>`
   (set repo-local in `.git/config`). NEVER use a Codebuff/Codebuff-Team/
   AI-tool identity as author or committer, and NEVER include "Codebuff",
   "Co-Authored-By", "Generated with …", or any AI-attribution trailer in
   commit messages or file text. The `.githooks/commit-msg` guard rejects
   these mechanically — do not bypass it.
2. **Identity is `ph-compliance-mcp`.** The product is the **Philippine Legal &
   Compliance MCP** (ADR-004). Package name, server name (`ph-compliance`),
   resource scheme (`ph-compliance://`), env prefix (`PH_COMPLIANCE_`), README,
   `llms.txt`, and docs must all say this. Never introduce new `ph-legal`
   strings (the `ph-legal-mcp/` directory is a historical artifact renamed at
   first git init).
3. **Scope: legal + compliance, 15 domains.** The V1 taxonomy is 15 domains
   (ADR-000 core 11 + ADR-004 compliance expansion: business-transactional,
   accounting, payroll, human-resources). Coverage includes statutes,
   jurisprudence, and NGA/LGU/GOCC issuances. New domains still go through an
   ADR. No embeddings before Phase 5 (ADR-002).
3. **ADR discipline.** Any architectural decision gets an ADR in `docs/adr/`
   (next number). Update ADRs you materially change.
4. **FTS5 first.** `src/retrieval/fts-search.ts` + `confidence.ts` are the V1
   retrieval path. No vector/hybrid files before Phase 5.
5. **No synthesis without citation.** Tool responses carry structured citations;
   below confidence threshold → "insufficient corpus coverage."
6. **Provenance on everything ingested.** URL + retrieval date + content hash.
7. **Checksums are load-bearing.** `corpus-loader.ts` verifies each asset's
   SHA-256 before caching; on mismatch it refuses to load and reports clearly.
8. **LOC budget.** `scripts/check-loc-budget.mjs`: warn >220 LOC, flag >350.
   Keep modules small.
8b. **Agency acronyms are word-boundary anchored.** In issuance normalizers,
   `AGENCY_HINTS` acronyms must use `\b…\b` so "SEC" cannot match inside
   "SECURITY" (misdetects SSS/GSIS documents as the SEC).
9. **Eval before release.** The eval suite (`evals/golden/evaluation.xml` —
   10 QA pairs seeded; `run-eval.ts` harness is Phase 5) becomes a hard
   release gate in Phase 5 (blueprint §12/§14) — don't regress it, don't skip it.
9b. **MCP tool conventions (mcp-builder skill).** Every tool registers with
   zod *object* schemas for `inputSchema`/`outputSchema`, all four annotations
   (readOnly/destructive/idempotent/openWorld), and returns
   `structuredContent` (never truncated) alongside a text rendering. **The SDK
   runtime-validates `structuredContent` against `outputSchema`** — every
   branch (including "not found"/"insufficient coverage") must satisfy the
   schema, or the tool errors out. Target the SDK API of `^1.30.0` (peers:
   zod `^3.25`); `registerResource` is the 4-arg form with URL callbacks.
10. **Document every session.** Write `../second-brain/sessions/<date>-<phase>.md`,
    update `state.md` and roadmap checkboxes. Context does not survive resets —
    the brain does.

## Verification

- `pnpm check` runs typecheck + lint + test + LOC budget; `ci.yml` enforces it.
- Docs/public-surface hygiene: every session, confirm `README.md`, `llms.txt`,
  and `docs/seo.md` still match the tool list and domain count.
- Corpus builds run through `tsx` from source (`pnpm build:corpus`) so schema
  `.sql` files resolve correctly; the `tsc` build outputs only the server.
- SQL schemas: valid SQLite; FTS5 external-content tables with sync triggers.
- Workflows: valid YAML; `release.yml` must emit a `.sha256` per asset.
