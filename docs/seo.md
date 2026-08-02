# SEO & GEO — How This Repository Is Found

`ph-compliance-mcp` is optimized for both traditional search engines (SEO) and
generative engines / LLM crawlers (GEO). The goal: when an agent or a person
searches for *"Philippine law MCP"*, *"Philippines compliance MCP"*, *"PH legal
knowledge base"*, *"ph-compliance-mcp"*, or any of the domain keywords below,
this repository is discoverable, parseable, and trusted.

## GEO (Generative Engine Optimization) — AI-readability

LLMs ingest repositories through crawlers that prefer plain, factual,
structured Markdown. This repo follows the emerging **`llms.txt`** convention
([llmstxt.org](https://llmstxt.org)):

- **`/llms.txt`** (repo root) — a concise, token-efficient index of this
  repository: purpose, key facts, tool list, resources, and doc links. This is
  the file an LLM crawler reads first.
- **README.md** is written as a precise factual document — no marketing fluff,
  explicit non-negotiable constraints, a comparison table, and a FAQ that
  mirrors real user/agent questions (both humans and LLMs ask "is this legal
  advice?" and "how is accuracy guaranteed?").
- Tool names, resource URIs, domain slugs, and statute short titles are
  consistent and machine-readable — they are the same strings in code, tests,
  docs, and `llms.txt`.

## SEO — search-engine optimization at GitHub level

GitHub indexes README content, topics, and file names. We optimize for that:

- **H1 keyword**: "Philippine Legal & Compliance MCP" + the package name
  `ph-compliance-mcp` (the phrase people and agents search for).
- **Keywords** (in package.json `keywords` + README + docs): philippines,
  philippine-law, legal-tech, compliance, mcp, model-context-protocol,
  jurisprudence, statutes, republic-act, presidential-decree, supreme-court,
  governance, payroll, accounting, human-resources, gocc, lgu.
- **GitHub topics** (set on the repo settings page): `mcp`,
  `model-context-protocol`, `philippine-law`, `legal-tech`, `compliance`,
  `jurisprudence`, `philippines`, `law`, `legal`.
- **Descriptive badges** at the top of README (MCP, TypeScript, Node, SQLite
  FTS5, license, integrity) — crawlers and humans both read them.
- **Concrete install JSON** — the exact `mcpServers` block agents copy.
- **Structured tables** — tools, domains, comparison — dense, scannable facts.
- **`docs/sources.md`** — a research-backed list of canonical PH legal sources
  with URLs (authority signals: Official Gazette, LawPhil, SC E-Library,
  agency repositories).

## Repository naming & identity

- Package name: `ph-compliance-mcp`
- MCP server name: `ph-compliance`
- Resource scheme: `ph-compliance://`
- Env prefix: `PH_COMPLIANCE_`
- Default GitHub repo: `nicene-software/ph-compliance-mcp`

The physical directory (`ph-legal-mcp/`) is a historical artifact of the pre-
ADR-004 codename; the identity everywhere is `ph-compliance-mcp`. The directory
rename happens atomically at first git init (see ADR-004).

## Suggested README/repo hygiene (Phase 6, on track)

- Set GitHub topics (above) on the repo settings page.
- Add a `description` in GitHub repo settings mirroring package.json.
- Enable GitHub Pages for the docs if a hosted mirror is wanted.
- Keep `llms.txt` in sync with any README restructuring.
