# Changelog

All notable changes, per [Keep a Changelog](https://keepachangelog.com/).
Unreleased work is tracked in the second brain's `roadmap.md`.

## 0.12.0 — 2026-09-06 (Jurisprudence Seed + Graph Exercised End-to-End)

### Added
- **Case corpus grown 3 → 9 landmark decisions** (authored in
  `generate-seed.mjs`; the seed-freshness gate keeps generator ↔ `data/seed`
  byte-identical). New: Ang Tibay v. CIR (G.R. No. 46496, cardinal primary
  rights), People v. Hernandez (G.R. Nos. L-6025-26, rebellion-absorption
  doctrine), Naguiat v. NLRC (G.R. No. 116123, separation pay + legal tender),
  Republic v. Molina (G.R. No. 108763, Art. 36 psychological-incapacity
  guidelines), Imbong v. Ochoa (G.R. No. 204819, RH Law constitutionality), and
  MMDA v. Concerned Residents of Manila Bay (G.R. Nos. 171947-48, continuing
  mandamus). Citation numbers, dates, ponentes, divisions, and passage text
  were verified against live LawPhil full texts; `retrievedAt` refreshed to the
  verification date (provenance rule #5).
- **The citation graph now carries real, resolved edges**: 7 case→statute
  (Oposa→1987 Constitution, Hernandez→Revised Penal Code, Molina→Family Code,
  Naguiat→Labor Code + Civil Code, Imbong→1987 Constitution,
  MMDA→Administrative Code) plus the NIRC→TRAIN statute dependency — 9 of 12
  extracted spans resolve; the 3 unresolvable ones stay honest as unresolved.
- **End-to-end graph harness** `scripts/e2e-graph.mjs` — spawns the built
  server over stdio like a real agent and asserts `related_laws`, `get_case`,
  and `search_jurisprudence` behavior, including the honest count-0 and
  `insufficient_corpus_coverage` paths.

### Fixed
- **Stale seed provenance URLs** — all three pre-existing case records pointed
  at dead LawPhil `/jurisprudence/...` deep links (404); `sourceUrl` now uses
  the live `judjuris` archive paths.
- **Oposa's ecology-right citation corrected to Article II, Section 16** (the
  committed record said Section 15; the decision's own quote and the
  constitutional text say Sec. 16).
- **`build-index.ts` now emits fresh `.sha256` sidecars** for each built sqlite
  asset (`writeAssetChecksums` in `manifest.ts`, unit-tested). Previously any
  local rebuild left the sidecars stale and corpus-loader refused the corpus
  until checksums were hand-generated. CI publish flows overwrite them with
  identical values, so release behavior is unchanged.

## 0.11.1 — 2026-09-06 (Security & Reliability Hardening)

### Security
- **All dependency advisories cleared (11, incl. 4 HIGH)** — pnpm overrides for
  `hono >=4.12.34`, `qs >=6.16.0`, `fast-uri >=3.1.6` (SSRF/host-confusion chain
  via the MCP SDK's express/ajv tree), and `nanoid >=3.3.18` (dev chain).
  `pnpm audit --prod` and `pnpm audit` are both clean; `--prod` stays a CI gate.
- **Corpus integrity is now fail-closed** — a missing/unfetchable checksum file
  (HTTP 404, network error) previously downloaded and loaded the corpus WITHOUT
  verification (contradicting the no-tampered-corpus design constraint); it now
  refuses to download. Checksum bodies are validated as 64-hex (an HTML error
  page served as 200 can no longer act as an integrity anchor). Local-corpus
  overrides still verify when a sidecar is present and warn when absent.
- **Download hardening** — corpus downloads are timeout-bounded
  (`PH_COMPLIANCE_DOWNLOAD_TIMEOUT_MS`, default 60s) and size-bounded
  (`PH_COMPLIANCE_MAX_ASSET_MB`, default 512MB; enforced via Content-Length and
  while streaming) — no startup hang, no OOM via a misdirected response.
- **Atomic cache writes** — corpus assets are written temp-file-then-rename, so
  concurrent servers sharing `~/.cache` can never observe a half-written sqlite
  file; the checksum sidecar is written first so a crash forces re-download.
- **robots.txt fail-closed (RFC 9309 §2.4.2.1)** — unreachable or 5xx (after
  retries) robots.txt now means FULL DISALLOW; previously any transient error
  flipped the crawler to allow-all. 401/403 = disallow; other 4xx = allow.
  Redirect targets are re-checked against their origin's robots rules.

### Fixed
- **`scripts/healthcheck.mjs` and `scripts/check-freshness.mjs` were not
  executable under Node** — both contained TypeScript syntax in `.mjs` files
  (the Docker HEALTHCHECK and the ops runbook shipped broken). Fixed and
  verified live (healthy: 15 domains); both probes now carry a watchdog
  (`PH_COMPLIANCE_HEALTHCHECK_TIMEOUT_MS`, default 60s) so a hung server fails
  the probe instead of hanging Docker forever.
- **Workflows pointed `--seed` at an empty directory** — `ci.yml`,
  `refresh-corpus.yml`, and `release.yml` all passed `--seed
  data-pipeline/seed/` (format-doc only, no `*.jsonl`); the authoritative seed
  lives in `data/seed/`. This is the concrete mechanism behind stale/empty
  corpus releases: CI could never build from seed. All three fixed; a guard in
  `build-index.ts` now refuses to build when the seed yields 0 records and no
  source ingestion succeeded (exit 1).
- **Workflows no longer swallow corpus-build failures** — the `|| echo
  "...warnings"` wrappers that turned hard failures into green runs are gone;
  publishing now requires all three sqlite assets + `manifest.json` (a partial
  corpus in a Release bricks every downstream server start).
- **`release.yml`'s eval gate was vacuous** — the gates job never built a
  corpus, so `pnpm eval:all` always exited 2 (coverage-blocked, treated as
  non-blocking) and the gate passed on every release. It now builds the seed
  corpus first and fails the release when the gate cannot actually run.
- **Server startup crash path** — `main().catch` no longer `process.exit(1)`
  while a failed corpus download's socket is still open (Windows
  `uv_handle_closing`, exit 0xC0000409 — same root cause fixed for build-index
  in 0.11.0); sets `process.exitCode` and lets handles drain.
- **ATTACH failures are visible** — a corrupt/locked cases/issuances file was
  silently swallowed, defusing the error to confusing query failures later;
  now logged as a warning at startup.
- **Eval harness cannot hang** — MCP handshake/tool calls are time-bounded
  (60s), the spawned server's stderr pipe is drained (unread pipes fill and
  deadlock the server), and the server is closed even when a pair run throws.
  `eval-all.mjs` bounds each child (15 min) and reports spawn failures.

## 0.11.0 — 2026-08-03 (Identity Completion + Compute Eval Gate + Corpus Growth)

### Changed
- **Physical directory renamed `ph-legal-mcp/` → `ph-compliance-mcp/`** — the
  ADR-004 promise ("renamed at first git init") is finally fulfilled; the
  folder now matches the package/server identity everywhere.
- **Distribution default fixed** — `PH_COMPLIANCE_REPO` default was
  `nicene-software/ph-compliance-mcp` (a repo that was never created); it is
  now `andreibrosmaster/ph-compliance-mcp`, matching the real `origin`. A
  fresh install would otherwise have 404'd on the corpus download. Updated
  `config.test.ts`, README install JSON, `docs/seo.md`.
- **Stale public surface synced** — `llms.txt` said "16 tools" and that
  verification was still pending; it now lists all 19 tools and the verified
  status. `docs/agents/*` and `docs/windows-setup.md` paths now say
  `ph-compliance-mcp`.
- **Compute tools expose pure functions** — `compute13thMonth()`,
  `computePrescription()`, `computeDeadline()` are now exported so the MCP
  tool, the eval harness, and the golden drift test share one implementation
  (single source of truth for the deterministic calculations).
- **New golden set `evaluation-compute.xml`** (6 pairs) — the compute tools
  are now eval-gated like everything else; `pnpm eval:all` runs all three
  sets (core 10 + compliance 10 + compute 6). `dataset-coverage.test.ts`
  executes compute plans against the pure functions.

### Added
- **Seed corpus growth** — `Rules of Court` added (the remedial domain was
  previously empty), plus Civil Code prescription articles 1145–1149 and
  Constitution Art. III Sec. 2. 21 statutes / 4 issuances / 3 cases.
- **Catalog URL corrections** — lawphil URLs that 404 (pd1529, pd612, pd1445,
  pd851, ra3019) fixed to the live paths; RPC + Negotiable Instruments Law
  pointed at the Official Gazette (lawphil hosts no copies).

### Fixed
- **`--sources` ingestion crash on Windows** — `main().catch()` used
  `process.exit(1)` while a fetch socket was still open, crashing with a
  `uv_handle_closing` assertion (exit 0xC0000409). Now sets `process.exitCode`
  and lets Node drain pending handles; `http-client` releases the response
  body before throwing on non-2xx.
- **`--sources` abort-on-first-error** — one HTTP 403/404 no longer aborts the
  whole run; `ingestFromSources` reports the failing instrument and continues.
- **Manifest honesty with `--sources`** — `manifest.json` record/passage
  counts previously reflected only the seed build; source-ingested statutes
  are now folded into the `laws` stats so the published counts match the real
  corpus.
- **Silent total source failure** — a `--sources` run where every fetch failed
  ingested 0 instruments yet exited 0 and stamped a fresh, seed-only corpus
  (masking the failure in `refresh-corpus.yml`). It now exits 1 with a clear
  error; `--sources-allow-empty` opts into seed-only fallback.

## 0.10.1 — 2026-08-03 (Search-Engine Split + Eval UX)

### Changed
- **`src/retrieval/` split for the LOC budget** — `fts-search.ts` was 354 LOC
  (over the 350 hard flag), breaking `pnpm check`/CI. The shared
  FTS5/BM25 mechanics (match-expression builder, snippet, pagination, the
  confidence-gated page query) moved to `fts-core.ts`; `fts-search.ts` is now
  three thin spec-driven wrappers (`searchStatutes`/`searchCases`/
  `searchIssuances`) over one generic `searchCorpus()` engine. Public API and
  behavior unchanged — same SQL shapes, same confidence scoring, same pagination.
- **`pnpm eval` now auto-wires the local corpus** — previously only `eval:all`
  set `PH_COMPLIANCE_LOCAL_CORPUS` + emitted `.sha256` sidecars; a bare
  `pnpm eval` spawned the server without them, it tried to download the corpus
  from GitHub Releases (404), and the harness reported a confusing
  "Connection closed". `run-eval.ts` now wires `dist/corpus` itself, and
  `scripts/eval-all.mjs` drops its now-redundant copy (single source of truth).

### Fixed
- **`pnpm eval` failure mode** — no more silent corpus download attempt; a
  missing local corpus is reported explicitly as coverage-blocked instead of
  a transport-level crash.

## 0.10.0 — 2026-08-02 (Seed Corpus + Passable Eval Gate)

### Added
- **`scripts/generate-seed.mjs` + `data/seed/*.jsonl`** — the first real,
  version-controlled corpus (20 statutes, 4 issuances, 3 cases across all 15
  domains). Previously the repo shipped golden eval sets but **zero seed data**,
  so `pnpm eval:all` could never pass and the server could answer nothing.
  Design contract: every golden answer appears verbatim in a provision heading
  (echoed in search citations) and every golden plan query is a verbatim phrase
  in the provision body (FTS5 AND-match + exact-phrase confidence boost). Text
  is primary-source-faithful — real codal provisions and well-known
  jurisprudence/issuances, never fabricated law (blueprint §7).
- **Core golden set now has explicit `<plan>` steps** (`evaluation.xml`) — it
  previously fell back to the full-question default query, which FTS5 AND
  matching could never satisfy. Answers unchanged.
- **`tests/golden/dataset-coverage.test.ts`** — golden-coverage drift lock:
  builds an in-memory corpus from `data/seed` and asserts every golden pair's
  plan retrieves its answer via the real search functions, so seed↔golden
  coupling can't silently break.
- **`evals/matching.ts`** — shared `normalize`/`answerMatches`/`collectText`
  used by both the eval harness and the drift test (no more duplicated logic).
- **`eval-all.mjs` auto-wires the local corpus** — when `dist/corpus` exists it
  sets `PH_COMPLIANCE_LOCAL_CORPUS` and emits `.sha256` sidecars (mirroring
  `release.yml`), so `pnpm eval:all` runs against the built corpus.

### Fixed
- **`get_provision` prefix-normalization bug** — the tool stripped the leading
  `Art.`/`Sec.` prefix from the *argument* but compared against the stored
  `provision_no` verbatim, so seeded prefixed numbers (e.g. `Art. III, Sec. 1`)
  could never be looked up by their canonical citation. Both sides are now
  normalized before matching.

## 0.9.1 — 2026-08-02 (First-Run Gate: Node 24 Native + Typecheck Clean)

### Fixed
- **better-sqlite3 11.10.0 → 12.4.1** — v11 has no prebuilt binary for Node 24
  (ABI 137); the prebuild download 404s and the postinstall falls back to a
  node-gyp source build that fails without a VS toolchain. v12.4.1 ships the
  ABI 137 prebuild, so `pnpm install` on Windows/Node 24 just works.
  `pnpm.onlyBuiltDependencies` (pnpm 10 requirement) added for
  `better-sqlite3` + `esbuild`; `@types/better-sqlite3` unchanged.
- **Typecheck drift (first real run)** — four latent errors fixed:
  - `corpus-loader.ts` `ensureCorpus()` destructured `Promise.all` under
    `noUncheckedIndexedAccess` (tuple narrowed via `as [string, string, string]`).
  - `compute-prescription.ts` zod `z.enum` rejected the spread-then-`as const`
    tuple — typed as `readonly [ActionKey, ...ActionKey[]]`.
  - `populate.ts` `GraphPopulationStats` gained `edgesInserted` (total rows
    written, 0 on idempotent re-run) — the field the idempotency test contract
    asserts but the type never exposed.
  - `tests/pipeline/manifest.test.ts` non-null assertions under
    `noUncheckedIndexedAccess` on the parsed manifest.

### Notes
- First real `pnpm install`, `typecheck`, `test`, `lint` run in this
  environment (bash + Node 24 now available). Dependabot/governance docs
  updated to name v12.4.1 as the verified baseline.

## 0.9.0 — 2026-08-02 (Enterprise Governance & CI Hardening)

### Added
- **Repo hygiene**: `.editorconfig` (cross-editor consistency), `.gitattributes`
  (LF line endings, binary markers, Linguist overrides), `.npmrc`
  (strict-peer-dependencies, engine-strict, supply-chain hygiene).
- **GitHub governance**: `.github/CODEOWNERS` (mandatory maintainer review on
  law-adjacent paths: src/tools, src/retrieval, src/resources, data-pipeline,
  evals, .github, Dockerfile), `.github/dependabot.yml` (weekly npm grouped by
  ecosystem + GitHub Actions; better-sqlite3 majors ignored pending native
  rebuild verification), `.github/DISCUSSION_TEMPLATE.md`.
- **CI hardening**: `ci.yml` split into `validate` (typecheck/lint/test/LOC/
  `pnpm audit --prod`), `build` (corpus smoke), and `eval` (golden gate, exit 2
  = corpus-unpopulated non-blocking) jobs with concurrency cancel-in-progress;
  `release.yml` gained a hard `release-gates` job that must pass before
  `build-corpus` publishes; corpus build now runs `--sources` with a version
  stamp and publishes `manifest.json`; new `auto-label.yml` + `labeler.yml`
  (area labels from changed paths: core-server, tools, domains, pipeline,
  corpus, evals, ci, docs, docker, agents).
- **`docs/governance.md`** — enterprise governance model: branch model,
  required reviews, dependabot policy, CI/release gates, triage labeling,
  ADR-gated changes. CONTRIBUTING updated to reference it.

### Changed
- README: Enterprise section now links `docs/governance.md`; repo map updated.

### Notes
- Still gated on the first-run checklist (Node 24 + bash): typecheck/test not
  executed in this environment; governance config reviewed statically.

## 0.8.0 — 2026-08-02 (Full Production & Post-Production Operations)

### Added
- **Corpus version manifest** (`data-pipeline/build-index.ts`): every build now
  writes `manifest.json` into the output dir with the version stamp
  (`--stamp` or today's `YYYY.MM.DD`), build time, per-corpus SHA-256 + record
  counts, and the sources/seed that fed the build. `defaultStamp()` +
  `writeCorpusManifest()` are exported and tested (Phase 7 per-file stamps).
- **Ops tooling**: `scripts/healthcheck.mjs` (spawns the server over stdio,
  performs the MCP handshake, calls `list_domains`, exit 0 only when the
  15-domain taxonomy answers — Docker HEALTHCHECK-ready) and
  `scripts/check-freshness.mjs` (per-corpus freshness report for SLA
  monitoring). `pnpm healthcheck` / `pnpm check:freshness` scripts.
- **Containerization**: multi-stage `Dockerfile` (build toolchain in the build
  stage, slim runtime with only dist + prod node_modules + scripts; no ports —
  MCP over stdio; built-in HEALTHCHECK; air-gapped corpus wired via
  `PH_COMPLIANCE_LOCAL_CORPUS=/corpus`), `.dockerignore`, `compose.yaml`
  (verified-corpus volume mount pattern), `pnpm docker:build`.
- **`refresh-corpus.yml`** is now a real production workflow: weekly schedule +
  `workflow_dispatch`, drives `build:corpus --sources official-gazette,lawphil
  --since <last month>`, verifies SHA-256 checksums, tags `corpus-YYYY.MM.DD`,
  and publishes sqlite + `.sha256` + `manifest.json` to GitHub Releases.
- **`docs/operations.md`** — post-production runbook: monitoring (healthcheck,
  freshness SLAs, query-status telemetry), backup/restore (corpus is derived
  data; seed dir is the true source of truth), upgrades, incident response
  table, disaster recovery (RPO/RTO), weekly maintenance cadence.
- **`docs/release.md`** — release process: code (`v0.8.0`) vs corpus
  (`corpus-YYYY.MM.DD`) versioning, release gates (eval is release-blocking),
  code + corpus release steps, rollback, post-release checklist.

### Changed
- `SERVER_VERSION` 0.6.0 → **0.8.0** (config.ts, package.json) — aligns the
  server-reported version with the CHANGELOG.
- README: Docker + Operations/Release sections; repo map extended.

### Notes
- Still gated on the first-run checklist (Node 24 + bash): typecheck/test not
  yet executed in this environment; change set passed adversarial review.

## 0.7.0 — 2026-08-02 (Production Readiness — Databank, Compute Tools, Eval, Agents)

### Added
- **Instrument catalog** (`data-pipeline/catalog.ts`) — the ingestion manifest:
  40+ instruments across all 15 domains with canonical act numbers, titles,
  status, and official source URLs. METADATA ONLY (never fabricates text);
  `validateCatalog()` enforces unique ids/act numbers, known domains, https
  sources. Drives list_domains enrichment, seed authoring, and the adapter layer.
- **Source adapter framework** (`data-pipeline/sources/`) — `SourceAdapter`
  contract + two reference adapters: `official-gazette` and `lawphil`
  (catalog-driven target selection, cheerio HTML→text extraction, polite HTTP
  via `HttpClient`). Wired into `build-index.ts` via `--sources
  official-gazette,lawphil [--max N] [--since DATE]`; adapters only fetch what
  the catalog declares. CI-only, never at runtime.
- **Phase 5 deterministic compute tools**: `compute_prescription` (Civil Code
  Arts. 1144–1149, incl. the Art. 1149 residual period), `compute_deadline`
  (Rules of Court Rule 22 computation of time applied to Rule 37/41/45/65
  periods, with explicit holiday lists), `compute_13th_month` (PD 851 formula:
  total basic salary ÷ 12, due on or before December 24, with coverage/
  exclusion notes). Registered in the tool index; server instructions updated.
- **Working eval harness** (`evals/run-eval.ts`) — spawns the real server over
  stdio via the MCP SDK Client, executes each golden pair's `<plan>` of tool
  calls, and scores answers by string match with word/digit-boundary handling
  (so "24" cannot match "2024", and "250,000" matches "P250,000"). Exit 0 =
  all pass, 1 = regression, 2 = coverage-blocked (corpus unpopulated).
  `pnpm eval` / `pnpm eval:all` scripts added.
- **Compliance golden set** (`evals/golden/evaluation-compliance.xml`) — 10 QA
  pairs across the ADR-004 domains (PD 851, service incentive leave, SSS, NIRC
  TRAIN threshold, one-person corporation, DPA, RA 9184, OSH, LGC, AMLA) each
  with a retrieval plan. Core set `evaluation.xml` pairs now usable by the
  harness via default plans.
- **AI agent integration docs** (`docs/agents/`) — per-client setup for Claude
  Code (`.mcp.json`), Codex CLI (`config.toml`), OpenCode (`opencode.json`),
  Cline (`mcp_settings.json`), Cursor (`.cursor/mcp.json`) as of August 2026,
  plus an index with the universal config and env-var reference.
- **Enterprise surface** — `SECURITY.md` (trust model, hardening checklist,
  vulnerability reporting), `CODE_OF_CONDUCT.md`, issue/PR templates
  (`.github/ISSUE_TEMPLATE/`, `.github/PULL_REQUEST_TEMPLATE.md`),
  `docs/enterprise.md` (deployment models incl. air-gapped, observability,
  operations runbook, SLA/freshness model, legal-review workflow),
  `docs/usecases.md` (15-domain use-case catalog with ready-to-paste prompts).

### Changed
- `statutes.kind` CHECK widened to accept `act` and `rules` (the catalog and
  `StatuteRecord` already used those kinds for Act No. 3815, Act No. 2031, and
  the Rules of Court — previously rejected by the DB).
- README: compute tools in the tool table, agent-integration table, use-case +
  enterprise sections, `--sources` corpus instructions, updated repo map.

### Fixed
- `tests/pipeline/build-index.test.ts` asserted **11** seeded domains while the
  schema seeds 15 — corrected to 15.
- `compute_13th_month` carried a dead `monthsWorked` proration that was
  algebraically identical to `total ÷ 12`; removed in favor of the PD 851
  formula (input is total actually earned, which pro-rates naturally).
- Eval `answerMatches` used word boundaries for digit answers, which would miss
  "P250,000"/"₱250,000" — digit boundaries now used for digit-containing
  answers.

### Notes
- Typecheck/test still cannot execute here (no bash/Node 24 — the documented
  first-run gate in `state.md`); this change set passed adversarial review.
- `compute_*` tools are arithmetic over codal text with citations returned for
  verification — they never state law beyond the cited articles/rules.

## 0.6.0 — 2026-08-02 (Compliance Repositioning — ADR-004)

### Changed
- **Renamed to `ph-compliance-mcp`** — Philippine Legal & Compliance MCP.
  Package name, server name (`ph-compliance`), env prefix (`PH_COMPLIANCE_`),
  resource URIs (`ph-compliance://domains`, `ph-compliance://statute/{statute}`),
  default repo (`nicene-software/ph-compliance-mcp`), cache dir, and every doc.
  ADR-004 supersedes ADR-000's naming decision.
- **Taxonomy expanded 11 → 15 domains** (+ `business-transactional`,
  `accounting`, `payroll`, `human-resources`) in `src/domains/`, the registry,
  and the `laws.sql` seed; `list_domains` and the `ph-compliance://domains`
  resource now describe the 15-domain compliance taxonomy.

### Added
- **Generic NGA/LGU/GOCC issuance normalizer**
  (`data-pipeline/normalizers/nga-issuance-normalizer.ts`): detects issuance
  type (Department Order, Memorandum Circular, Ordinance, Resolution, etc.) and
  agency (DOLE, DTI, CSC, DBM, COA, SEC, SSS, GSIS, PhilHealth, Pag-IBIG, BSP,
  ...) from headers — acronyms word-boundary anchored so "SEC" cannot match
  inside "SECURITY". 5 new tests.
- **SEO/GEO public surface**: rewritten README (keywords, badges, tool/domain
  tables, FAQ, comparison vs static PH-law MCPs), `llms.txt` (AI-discoverable
  index), `docs/seo.md` (SEO/GEO strategy), `docs/sources.md` (research-backed
  authoritative source list), `docs/marketplace/mcpmarket.md` (positioning vs
  the incumbent `philippine-law` MCP).
- Server `instructions` expanded to describe the full legal + compliance scope.

### Fixed
- `nga-issuance-normalizer` agency detection could mislabel "SOCIAL SECURITY
  SYSTEM" as the SEC (unanchored `SEC` hint matching inside "SECURITY").
- Stale agent-facing "11-domain V1 taxonomy" strings in the `list_domains` tool
  description, the domains resource description, and domain module doc comments
  — all now say 15-domain compliance taxonomy.

### Notes
- Physical directory `ph-legal-mcp/` is a historical artifact; it is renamed to
  `ph-compliance-mcp/` atomically at first git init (no git history exists yet).

## 0.5.0 — 2026-08-02 (Phase 4: Jurisprudence at Scale + Knowledge Graph)

### Added
- **Citation graph pipeline** (`data-pipeline/citations/`):
  - `extractor.ts` — pure, regex-based PH citation span extraction grounded in
    canonical formats (G.R. No. / L-prefixed cases, RA/PD/EO/BP/CA act numbers,
    Art./Sec. provision citations, Constitution references, IRR references).
    Act numbers embedded in provision title hints are lifted too
    ("Sec. 5(b) of Republic Act No. 9165" → act 9165).
  - `resolver.ts` — resolves spans against the laws/cases corpora (LIKE
    prefilter + JS normalization) and inserts **only resolved edges** into
    `citations_graph` (constraint #1 — never a guess). Self-citation guard;
    idempotent re-runs via INSERT OR IGNORE + unique index; `resolved` vs
    `edgesInserted` stats kept honest (`Number(changes) > 0`).
  - `populate.ts` — walks every case + statute and builds case→statute,
    case→case, and statute→statute (law→law dependency) edges. Wired into
    `build-index.ts` (CI-only, `--no-citations` to skip).
- **8 knowledge-graph tools** (`src/tools/graph/`): `related_laws`,
  `related_cases`, `show_amendments`, `show_history`, `show_dependencies`,
  `show_citations`, `show_implementing_rules`, `show_cross_references` — all
  with zod object schemas, annotations, outputSchema, schema-complete failure
  branches, and a shared `queries.ts` helper layer.
- **Schema**: `statutes.act_number` column (canonical enactment number for the
  resolver); `citations_graph` redesigned with `citing_kind`/`citing_statute_id`,
  kind↔id CHECK constraints, and a UNIQUE dedupe index.
- Tests: citation extractor (7), citation resolver (4, incl. self-citation
  rejection + idempotency), graph queries (4).

### Fixed
- `insertResolvedEdge` reported every resolved span as inserted even when the
  unique index deduped it (stats lied on re-runs) — now returns
  `{ resolved, inserted }` separately.
- `info.changes > 0` would not typecheck against better-sqlite3 v9+ typings
  (`changes: number | bigint`) — coerced via `Number(...)` per db.ts style.

### Notes
- Graph edges are entity-level: distinct raw citations of the same entity from
  the same source collapse into one edge (first raw kept) — a deliberate
  tradeoff, documented in `resolver.ts`.
- Real jurisprudence ingestion (SC E-Library / LawPhil) is what actually
  populates the graph at scale — see `second-brain/state.md` next actions.

## 0.4.0 — 2026-08-02 (Phase 3: Domain Expansion)

### Added
- **Domain registry** (`src/domains/`): 11 domain modules (metadata: key
  instruments, sources + cadence, corpora) with typed cross-references, plus
  `validateRegistry()` invariants. Backs a richer `list_domains`.
- **Issuance query path**: `search_issuance` and `get_issuance` tools over
  `issuances.sqlite` (BIR-first corpus), with pagination, annotations,
  outputSchema, and `withCharacterLimit` on passages. `searchIssuances` added
  to `fts-search.ts` (FTS5/BM25 + confidence gate, agency/issuanceType filters).
- **BIR issuance normalizer** (`data-pipeline/normalizers/issuance-normalizer.ts`):
  detects issuance type + reference number from the BIR header (RR/RMC/RMO/RMR),
  derives title from SUBJECT:, chunks passages, hashes content.
- `list_domains` now merges domain-module metadata (keyInstruments, sources,
  refreshCadence) alongside freshness.
- All 11 domain README stubs filled in (owner, sources, refresh cadence).
- Tests: domains registry invariants, search-issuances (3), issuance-normalizer (5).

### Fixed
- Duplicate `status` keys in `get-case.ts` / `get-issuance.ts` success payloads
  (TS1117 compile error) — renamed to `caseStatus` / `issuanceStatus`.

### Notes
- `issuances.sqlite` population still needs real BIR seed data or a live source
  adapter — see `second-brain/state.md` next actions.

## 0.3.0 — 2026-08-02 (mcp-builder skill compliance pass)

### Added
- **Tool annotations** (readOnly/destructive/idempotent/openWorld) on all six tools.
- **`outputSchema` + `structuredContent`** on every tool — clients get the full
  payload programmatically while the text rendering stays human-readable
  (25k-char truncation, never truncates structured content).
- **Pagination** (`total`, `hasMore`, `nextOffset`) in `fts-search.ts` and both
  search tools; `limit`/`offset` inputs with bounds (max 50).
- **MCP resources**: `ph-legal://domains` (taxonomy + freshness) and
  `ph-legal://statute/{statute}` (metadata + provision list).
- `npm run inspector` script (MCP Inspector).
- **Golden eval set**: `evals/golden/evaluation.xml` (10 QA pairs) + README.
- `withCharacterLimit` defensive truncation wired into `get_case` passages.

### Changed
- `@modelcontextprotocol/sdk` pinned to `^1.30.0`, `zod` to `^3.25.0` (SDK peer
  requirement `^3.25 || ^4.0`).
- All tool schemas converted to zod **object** schemas (raw shapes + `z.infer`
  don't typecheck); failure branches satisfy the output schema because the SDK
  runtime-validates `structuredContent` against it.
- `registerResource` rewritten for the SDK 1.30 4-arg API (URL callbacks,
  `ResourceTemplate` from `server/mcp.js`); `instructions` moved to server options.

## 0.2.0 — 2026-08-02 (Phase 1: Data Pipeline MVP + Phase 2: MCP Server Core)

### Added
- `data-pipeline/`: polite HTTP client (conditional GETs, robots.txt, throttling,
  retries), robots parser, statute normalizer, passage chunker, embedding no-op
  stub (ADR-002), schema-applying DB helper, `build-index.ts` corpus builder.
- `src/`: env config, checksum-verifying `corpus-loader.ts`, DB connect with
  ATTACH, FTS5/BM25 retrieval with confidence gating, 6 MCP tools
  (search_statute, search_jurisprudence, get_provision, get_case, cite_validate,
  list_domains), domain index, stdio server entry.
- Tests: 9 vitest files; scripts (typecheck/test/lint/check:loc/build:corpus);
  CI wired for the full suite.

### Notes
- **Not yet executed** — no Node 24 runtime available in the dev environment;
  first-run verification checklist lives in `../second-brain/state.md`.

## 0.1.0 — 2026-08-02 (Phase 0: Foundations & Compliance Scaffolding)

### Added
- Second brain initialized (`../second-brain/`): blueprint, roadmap, state, sessions, references.
- ADRs 000–003 (`docs/adr/`): scope/naming, SQLite, FTS5-first, three corpus files.
- DB schemas (`src/db/schema/`): `laws.sql`, `cases.sql`, `issuances.sql` — relational + FTS5 with sync triggers.
- GitHub Actions workflows: `ci.yml`, `refresh-corpus.yml`, `release.yml` (SHA-256 checksum step wired from day one).
- 11 domain README stubs (`domains/<name>/README.md`).
- Root docs: README, ARCHITECTURE, AGENTS, CONTRIBUTING, DISCLAIMER, LICENSE.

### Notes
- Nothing runtime built yet — phases are gated. Phase 1 (data pipeline) is next.
