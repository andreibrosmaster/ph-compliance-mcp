# Enterprise Deployment & Operations

ph-compliance-mcp is built to be embedded in enterprise AI workflows: local
stdio server, zero runtime network egress, verifiable corpus, deterministic
compute tools, and a hard eval gate. This guide covers deployment, hardening,
and operations for teams running it at scale.

## Deployment models

### 1. Per-developer (default)

Each developer runs the server locally through their AI client
(Claude Code / Codex / OpenCode / Cline / Cursor). Corpus is downloaded once
per machine and cached. See `docs/agents/`.

### 2. Shared team corpus (recommended for consistency)

Build the corpus once on CI, verify checksums, and publish the artifact. Point
every developer's client at it:

```bash
# CI: build + verify
pnpm install
pnpm build
pnpm build:corpus -- --seed data/seed --out dist/corpus
sha256sum dist/corpus/*.sqlite > dist/corpus/SHA256SUMS
```

Distribute `dist/corpus/`, then set in each client config:

```json
"env": {
  "PH_COMPLIANCE_LOCAL_CORPUS": "/shared/verified/ph-compliance-corpus"
}
```

With `PH_COMPLIANCE_LOCAL_CORPUS` set, the server never downloads anything and
fails closed on missing/checksum-mismatched files.

### 3. Air-gapped / offline

Because runtime needs **zero network**, the same model works fully offline:
ship the built `dist/` plus a verified corpus on removable media. The only
network touchpoints are (a) first-run corpus download, (b) CI ingestion with
`--sources`, and (c) `pnpm audit` — all disabled by using a local corpus.

## Hardening

- **Run least-privilege.** The server never needs root; run under the agent's
  own principal, not a shared admin account.
- **Pin releases.** Install tagged versions; run `pnpm check` in CI
  (typecheck + lint + tests + LOC budget) and `pnpm audit --prod` with
  high/critical as release-blockers.
- **Verify the corpus.** Compare `SHA256SUMS` before shipping; the server also
  refuses to start on content mismatch.
- **Prevent prompt injection.** The server is retrieval-only. Instruct agents
  to treat retrieved legal text as data, never as instructions.
- **No secrets.** The server takes no API keys; keep env config to the
  documented `PH_COMPLIANCE_*` variables.

## Observability

- The server logs to **stderr** (never stdout, which is reserved for the MCP
  protocol). Set `PH_COMPLIANCE_LOG_LEVEL=debug` for troubleshooting.
- Each tool result returns a structured payload with status
  (`ok` / `insufficient_corpus_coverage` / `cannot_validate` / `invalid_*`) —
  build dashboards on those statuses to measure corpus coverage per domain.
- `list_domains` reports corpus freshness per domain; a scheduled job that
  polls it drives your freshness SLAs.

## Operations runbook

| Situation | Action |
| --- | --- |
| Tool returns `insufficient_corpus_coverage` | The corpus lacks a confident match — widen the query, or ingest more seed data for that domain; it is never a soft failure. |
| Server fails to start (first run) | Check cache dir write permission and network; then check the SHA-256 manifest mismatch message. |
| Corpus freshness stale | Re-run `pnpm build:corpus -- --sources official-gazette,lawphil --since <date>` in CI and republish. |
| Eval gate fails (`pnpm eval` exit 1) | A real regression — a golden answer no longer retrievable. Fix before release. |
| Eval gate exit 2 | Corpus unpopulated (coverage-blocked) — seed the corpus; not a code regression. |

## SLA / freshness model

- Statutes (Constitution, codes, major RA/PD): **quarterly** refresh plus
  triggered refresh on enactment of amending laws (amendments tracked
  version-aware via `provisions.valid_from/valid_until`).
- Jurisprudence: **weekly** sync of SC/CA/SB/CTA decisions.
- NGA/LGU/GOCC issuances: **weekly** for high-cadence agencies (BIR, SEC,
  DOLE), monthly otherwise.
- Every domain advertises its cadence in `list_domains` so agents can decide
  when to trust freshness.

## Legal review workflow

1. Agent runs retrieval + `cite_validate` and produces a draft with citations.
2. Reviewer (human lawyer) opens the cited provision via `get_provision`
   (exact corpus text) or the `source_url` provenance.
3. Version-aware amendments surfaced via `show_amendments` / `show_history`
   ensure the reviewer sees the current text, not a repealed one.
4. Draft states it is **information retrieval, not legal advice**; the
   DISCLAIMER applies.

## Capacity & performance

- SQLite FTS5 BM25 retrieval is single-digit-millisecond per query on the
  cataloged corpus scale; the bottleneck is corpus size, not query rate.
- The server is a single process per client (stdio). For team-scale use,
  prefer the shared-corpus model over trying to run one server for many
  clients — each MCP client owns its own server process by design.
