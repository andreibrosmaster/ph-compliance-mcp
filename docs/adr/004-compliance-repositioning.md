# ADR-004: Repositioning as Philippine Legal & Compliance MCP

- **Status:** Accepted (supersedes the naming decision in ADR-000)
- **Date:** 2026-08-02
- **Deciders:** project lead (product direction, following marketplace research)

## Context

The market research (mcpmarket.com, smithery.ai, glama.ai) shows existing
"Philippine Law" MCP servers are **static, bundled-SQLite statute searches** —
a fixed snapshot of a handful of laws, no jurisprudence, no government
issuances, no version history, no integrity verification. The product's
original v1 scope (11 legal domains, ADR-000) deliberately deferred a
compliance-platform framing to Phase 8+ to avoid scope creep.

Two external pressures changed the calculus:

1. **Market gap**: no MCP server covers Philippine law *and* compliance
   (business-transactional, accounting, payroll, HR) across statutes,
   jurisprudence, and NGA/LGU/GOCC issuances with provenance guarantees.
2. **Product positioning**: "legal" undersells the retrieval layer's real
   value — compliance work (payroll, accounting, HR, governance) is where
   grounded, citable retrieval earns its keep, and it is the differentiation
   that makes the server stand out on marketplaces.

## Decision

- **Rename** the product to **Philippine Legal & Compliance MCP**, package
  `ph-compliance-mcp`, server name `ph-compliance`, resource scheme
  `ph-compliance://`, env prefix `PH_COMPLIANCE_`.
- **Expand the V1 taxonomy from 11 to 15 domains** (ADR-000 core 11 +):
  `business-transactional`, `accounting`, `payroll`, `human-resources`.
- **Broaden corpus scope** to include government issuances across National
  Government Agencies (NGA), Local Government Units (LGU), and
  Government-Owned and Controlled Corporations (GOCC) — via the issuances
  corpus and a generic `nga-issuance-normalizer`.
- Keep the core engineering constraints intact (citation-grounded retrieval,
  provenance, checksums, version-aware provisions, FTS5-first, no embeddings
  before Phase 5). The rename is identity and scope, not architecture.
- Treat further domain expansion as ADR-gated, one domain at a time, through
  the same pipeline-proof gate.

## Consequences

- The physical directory `ph-legal-mcp/` becomes a historical artifact of the
  pre-ADR-004 codename; it is renamed to `ph-compliance-mcp/` atomically at
  first `git init` (no history exists yet to preserve).
- All identity surfaces (package.json, server name, resource URIs, env vars,
  README, llms.txt, docs) now carry the `ph-compliance` identity. No new
  `ph-legal` strings should be introduced (AGENTS.md rule 2).
- `list_domains`, resources, and the domain registry serve 15 domains.
- SEO/GEO: `llms.txt`, README keywords, docs/seo.md and docs/marketplace/
  mcpmarket.md are now part of the release surface and must stay in sync.

## Alternatives considered

- Keep `ph-legal-mcp` and 11 domains (rejected: misses the market gap the
  research identified; "legal" undersells compliance value).
- Full 30+ domain compliance platform now (rejected: same scope-explosion
  risk ADR-000 warned about — expansion stays incremental and ADR-gated).
