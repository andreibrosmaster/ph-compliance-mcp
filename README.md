# Philippine Legal & Compliance MCP — `ph-compliance-mcp`

> **The source-of-truth retrieval layer for Philippine law and compliance, over
> Model Context Protocol (MCP).** Statutes · Jurisprudence · Government
> Issuances (NGA / LGU / GOCC) — retrieval-grounded, citation-verified,
> version-aware, provenance-checked. Never a guesser.

[![MCP](https://img.shields.io/badge/MCP-Server-000000.svg)](https://modelcontextprotocol.io)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178c6.svg)](https://www.typescriptlang.org)
[![Node](https://img.shields.io/badge/Node-24-339933.svg)](https://nodejs.org)
[![SQLite FTS5](https://img.shields.io/badge/SQLite-FTS5-003B57.svg)](https://www.sqlite.org/fts5.html)
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)
[![Checksums](https://img.shields.io/badge/Integrity-SHA--256-blue.svg)](#corpus-integrity)

`ph-compliance-mcp` gives any MCP-capable agent (Claude, OpenCode, Cline, and
others) grounded, citable answers about Philippine law and regulatory
compliance — instead of an LLM's parametric (and frequently wrong) recollection
of PH law.

- **Legal**: 1987 Constitution, Civil Code, Revised Penal Code, Labor Code,
  Family Code, Rules of Court, and the full body of Republic Acts, Presidential
  Decrees, and Executive Orders.
- **Compliance & business**: corporate/commercial law, transactional and
  contracts, accounting & auditing, payroll & benefits (SSS, PhilHealth,
  Pag-IBIG, 13th month pay), and human-resources/workplace compliance (DOLE).
- **Government issuances**: memorandums and circulars of National Government
  Agencies (NGA), Local Government Unit (LGU) issuances and ordinances, and
  Government-Owned and Controlled Corporation (GOCC) rules.
- **Jurisprudence**: Supreme Court and appellate decisions, with a citations
  knowledge graph connecting cases and statutes.

> ⚠️ **Not legal advice.** This is an information-retrieval and citation layer,
> not a lawyer, judge, or source of legal counsel. See
> [DISCLAIMER.md](./DISCLAIMER.md).

---

## Why this MCP stands out

| Capability | ph-compliance-mcp | Typical PH-law MCPs |
|---|---|---|
| Corpus provenance | SHA-256 checksums per asset, verified on load; refuses on mismatch | Often static bundled snapshots |
| Version-aware law | `valid_from`/`valid_until` provisions + `amendments` log; `show_amendments`, `show_history` tools | Current-text only |
| Citations knowledge graph | `related_laws`, `related_cases`, `show_dependencies`, `show_citations` — only **resolved** edges | None |
| No-synthesis guarantee | Below confidence threshold → `insufficient_corpus_coverage`, never a guess | Varies |
| Coverage breadth | Laws + cases + NGA/LGU/GOCC issuances across **15 compliance domains** | Statutes only, typically |
| Freshness signal | `list_domains` reports corpus refresh timestamps per domain | None |

See [docs/marketplace/mcpmarket.md](./docs/marketplace/mcpmarket.md) for the
full competitive positioning, and the research-backed source list in
[docs/sources.md](./docs/sources.md).

---

## Quick start

### Requirements

- Node.js 24+ (pnpm recommended)

### Install (local stdio MCP server)

```json
{
  "mcpServers": {
    "ph-compliance": {
      "command": "npx",
      "args": ["-y", "github:nicene-software/ph-compliance-mcp"]
    }
  }
}
```

Corpus assets (laws/cases/issuances SQLite + `.sha256` checksums) download and
verify on first run, cached under `~/.cache/ph-compliance-mcp`.

### Run from source

```bash
pnpm install
pnpm dev            # stdio server (tsx)
pnpm inspector      # MCP Inspector UI
```

### Build the corpus from seed data

```bash
pnpm build:corpus -- --seed data-pipeline/seed --out dist/corpus
```

The `[citations]` pass then populates the knowledge graph
(`--no-citations` to skip). Live ingestion from official sources (CI-only,
robots-respecting, throttled):

```bash
pnpm build:corpus -- --sources official-gazette,lawphil --out dist/corpus
```

Every instrument is catalogued first (`data-pipeline/catalog.ts`, 40+
instruments across all 15 domains); adapters only fetch what the catalog
declares — nothing is ingested that isn't catalogued, and nothing is ever
fabricated.

---

## Tools

| Tool | Purpose |
|---|---|
| `search_statute` | Full-text search over statutes/provisions (FTS5/BM25, confidence-gated) |
| `get_provision` | Retrieve one provision with citation + source |
| `search_jurisprudence` | Full-text search over case decisions |
| `get_case` | Retrieve a case with passages and citation |
| `search_issuance` | Search government issuances (NGA/LGU/GOCC) |
| `get_issuance` | Retrieve one issuance |
| `cite_validate` | Validate/parse a Philippine citation |
| `list_domains` | 15-domain taxonomy + corpus freshness |
| `related_laws` | Statutes cited by a case (graph) |
| `related_cases` | Cases sharing cited statutes (graph) |
| `show_amendments` | Amendment log of a statute |
| `show_history` | Version history of a provision |
| `show_dependencies` | Law→law dependency edges |
| `show_citations` | Citations made by a case |
| `show_implementing_rules` | IRR references for a statute |
| `show_cross_references` | Domain cross-references + graph edges |
| `compute_prescription` | Deterministic prescriptive-period calculator (Civil Code Arts. 1144–1149) |
| `compute_deadline` | Deterministic filing-deadline calculator (Rules of Court Rule 22 + 37/41/45/65) |
| `compute_13th_month` | Deterministic 13th-month-pay calculator (PD 851) |

### Resources

- `ph-compliance://domains` — taxonomy + freshness
- `ph-compliance://statute/{statute}` — statute metadata + provision list

---

## Coverage: 15 compliance domains

| Domain | Key instruments |
|---|---|
| Constitutional | 1987 Constitution |
| Civil | Civil Code (RA 386) |
| Family | Family Code (EO 209) |
| Criminal | Revised Penal Code (Act 3815), special penal laws |
| Tax | National Internal Revenue Code (RA 8424), BIR issuances |
| Labor | Labor Code (PD 442) |
| Commercial/Corporate | Revised Corporation Code (RA 11232), SRC |
| **Business & Transactional** | Contracts, sales, agency, Negotiable Instruments (Act 2031), EODB (RA 11032) |
| **Accounting & Auditing** | Accountancy Act (RA 9298), PFRS, COA audit rules |
| **Payroll & Benefits** | 13th month pay (PD 851), SSS (RA 11199), PhilHealth (RA 11223), Pag-IBIG (RA 9679) |
| **HR & Workplace Compliance** | Labor Code standards, OSH (RA 11058), DOLE issuances |
| Remedial | Rules of Court |
| Administrative | Administrative Code (EO 292), civil-service rules, NGA memorandums |
| Local Government | Local Government Code (RA 7160), LGU issuances |
| Special/Cross-cutting | Data Privacy Act (RA 10173), EODB, consumer protection (RA 7394) |

---

## AI agent integrations

`ph-compliance-mcp` is a standard **stdio MCP server** — connect any
MCP-capable AI coding agent. Client-specific setup (as of August 2026):

| Client | Config | Guide |
|---|---|---|
| Claude Code | `.mcp.json` / `claude mcp add` | [docs/agents/claude-code.md](./docs/agents/claude-code.md) |
| OpenAI Codex CLI | `config.toml` / `codex mcp add` | [docs/agents/codex.md](./docs/agents/codex.md) |
| OpenCode | `opencode.json` `mcp` block | [docs/agents/opencode.md](./docs/agents/opencode.md) |
| Cline (VS Code) | `mcp_settings.json` | [docs/agents/cline.md](./docs/agents/cline.md) |
| Cursor | `.cursor/mcp.json` / `cursor mcp add` | [docs/agents/cursor.md](./docs/agents/cursor.md) |

The universal config (any client): command `node`, args
`["/abs/path/ph-compliance-mcp/dist/src/server.js"]`. See
[docs/agents/README.md](./docs/agents/README.md). Each tool returns BOTH
human-readable text and machine-parseable `structuredContent`, so agents can
use results in downstream automation.

## Use cases

From contract review and employment compliance to tax, payroll, procurement,
litigation deadlines, and NGA/LGU/GOCC issuance research — see
[docs/usecases.md](./docs/usecases.md) for ready-to-paste prompts across all 15
domains.

## Enterprise

Shared/verified corpus deployment, air-gapped operation, hardening, an
operations runbook, and a legal-review workflow: see
[docs/enterprise.md](./docs/enterprise.md). The eval harness
(`pnpm eval`) is the release gate — see [evals/README.md](./evals/README.md).
Security and contribution policies: [SECURITY.md](./SECURITY.md),
[CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md).

## Docker

A multi-stage `Dockerfile` ships a slim runtime image (no build toolchain, no
ports — MCP over stdio) with a built-in `HEALTHCHECK` and pre-wired air-gapped
corpus mount (`PH_COMPLIANCE_LOCAL_CORPUS=/corpus`):

```bash
docker build -t ph-compliance-mcp .
docker compose up --build -d     # see compose.yaml
```

## Operations & releases

- [docs/operations.md](./docs/operations.md) — post-production runbook:
  monitoring (`pnpm healthcheck`, `pnpm check:freshness`), backup/restore,
  upgrades, incident response, disaster recovery, weekly maintenance cadence.
- [docs/release.md](./docs/release.md) — code (`v0.9.0`) vs corpus
  (`corpus-YYYY.MM.DD`) versioning, release gates (eval is release-blocking),
  rollback, post-release checklist.
- [docs/governance.md](./docs/governance.md) — contribution model: branch
  protection, CODEOWNERS mandatory reviews, Dependabot, CI/release gates.
- Corpus builds are version-stamped: `build-index.ts` writes `manifest.json`
  (per-corpus SHA-256, record counts, sources) into the output dir; the weekly
  `refresh-corpus.yml` publishes it alongside the sqlite assets.

## Design constraints (non-negotiable)

1. **No synthesis without citation** — every tool response carries a structured
   citation resolved against the corpus; below the confidence threshold the tool
   returns "insufficient corpus coverage," never a best-effort guess.
2. **Information retrieval, not legal advice.**
3. **Primary sources over commentary** — codal text and decisions, not summaries.
4. **Version-aware, not just current-aware** — amendments/repeals/supersessions tracked.
5. **Provenance on everything ingested** — URL, retrieval date, content hash.

## Corpus integrity

Every corpus asset ships with a `.sha256` checksum (wired in CI from day one).
`corpus-loader.ts` verifies each asset before caching and **refuses to load on
mismatch** — a corrupted or tampered corpus fails loudly, never silently.

## Repository map

- `docs/adr/` — architecture decision records (ADR-000 scope; ADR-004 rename)
- `docs/sources.md` — authoritative PH legal data sources (research-backed)
- `docs/seo.md` — how this repo is indexed by search engines and LLMs (GEO)
- `docs/marketplace/mcpmarket.md` — competitive positioning
- `docs/agents/` — per-client setup guides (Claude Code, Codex, OpenCode, Cline, Cursor)
- `docs/enterprise.md` — enterprise deployment & operations
- `docs/operations.md` — post-production runbook (monitoring, backup, DR)
- `docs/release.md` — release process (code + corpus versioning, gates)
- `docs/usecases.md` — use-case catalog with ready-to-paste prompts
- `Dockerfile` / `compose.yaml` — containerized stdio server (air-gapped corpus)
- `scripts/healthcheck.mjs`, `scripts/check-freshness.mjs` — ops probes
- `src/db/schema/` — SQLite schemas: laws, cases, issuances
- `src/domains/` — 15 domain modules with metadata + cross-references
- `data-pipeline/` — ingestion: catalog → adapters → normalizers → chunkers → build
- `data-pipeline/catalog.ts` — the instrument catalog (ingestion manifest)
- `src/` — server, retrieval, tools, resources
- `evals/` — golden sets + working `run-eval.ts` harness
- `llms.txt` — AI-discoverable index of this repository

The roadmap lives in the project's second brain:
[`../second-brain/roadmap.md`](../second-brain/roadmap.md). Current state:
[`../second-brain/state.md`](../second-brain/state.md).

## For AI agents and crawlers

See [`llms.txt`](./llms.txt) for a machine-readable index of this repository,
and [`docs/seo.md`](./docs/seo.md) for the GEO/SEO strategy. This README is
written to be parseable by both humans and LLMs: precise, keyword-rich, and
factual — no marketing fluff that dilutes ground truth.

## License & disclaimer

Apache-2.0 licensed. `ph-compliance-mcp` is an information-retrieval tool, not a
source of legal advice — verify anything you rely on against the official
source. See [DISCLAIMER.md](./DISCLAIMER.md) and [LICENSE](./LICENSE).

---

### Frequently asked questions

**Is this a replacement for a lawyer?** No. It is a retrieval layer that cites
primary sources. It refuses to guess below a confidence threshold.

**Which sources are ingested?** Primary sources only — Official Gazette,
LawPhil, SC E-Library, and agency repositories (BIR, DOLE, CSC, DBM, COA, SSS,
PhilHealth, Pag-IBIG, DTI, and more). See [docs/sources.md](./docs/sources.md).

**How is accuracy guaranteed?** Every response carries a structured citation
resolved against the corpus; content hashes and SHA-256 checksums protect
corpus integrity; version-aware provisions track amendments.

**Can it answer payroll/compliance questions?** Yes — payroll, benefits,
accounting, HR, and business-transactional domains are first-class citizens,
not afterthoughts.

**How does it differ from a static PH-law MCP?** Live-corpus refresh cadence,
provenance verification, version-aware history, a citations knowledge graph,
and a no-guess guarantee.
