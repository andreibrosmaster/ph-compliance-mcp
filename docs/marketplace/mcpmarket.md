# Marketplace Positioning — Philippine Legal & Compliance MCP

Where and how `ph-compliance-mcp` stands out in MCP marketplaces
(mcpmarket.com, smithery.ai, glama.ai, mcp.so, GitHub).

## The incumbent: "Philippine Law" MCP

The existing mcpmarket listing (`philippine-law`, e.g. the `@ansvar/
philippine-law-mcp` package) is a **static, bundled-SQLite** full-text search
over a fixed set of statutes (Data Privacy Act, Cybercrime Act, SIM
Registration Act, E-Commerce Act, Revised Corporation Code, Consumer Act).

Its honest limitations:

1. **Static snapshot** — the dataset ships inside the npm package; it does not
   update as new laws pass or new decisions publish, unless the package is
   manually re-synced.
2. **Statutes only** — no jurisprudence, no government issuances, no NGA/LGU/
   GOCC regulatory materials, no compliance breadth.
3. **Current-text only** — no version-aware history (amendments/repeals), no
   citation graph.

## How ph-compliance-mcp differentiates

| Dimension | ph-compliance-mcp | Static PH-law MCPs |
|---|---|---|
| **Corpus model** | Release assets + SHA-256 checksums, refresh-cadence driven, verified on load | Bundled in package, stale by construction |
| **Breadth** | 15 compliance domains: legal **+** business-transactional, accounting, payroll, HR, NGA/LGU/GOCC issuances | A handful of statutes |
| **Jurisprudence** | Case corpus + citations knowledge graph (related_laws, related_cases, show_citations) | None |
| **Version-aware** | valid_from/valid_until provisions, amendments log, show_amendments/show_history | Current text only |
| **Integrity** | Refuses to load on checksum mismatch; content hashes per document | Unverifiable bundled data |
| **Honesty guarantee** | Confidence-gated: "insufficient corpus coverage" instead of hallucinated law | Best-effort search |
| **Freshness signal** | list_domains reports per-domain refresh timestamps | None |

## The pitch (for listing descriptions)

> The Philippine Legal & Compliance MCP — a retrieval-grounded source-of-truth
> layer for Philippine law, jurisprudence, and government issuances, built for
> production compliance work. Statutes (RA/PD/EO/codes), Supreme Court
> decisions, and NGA/LGU/GOCC issuances, all citation-verified, version-aware,
> and checksum-protected. 16 tools including a citations knowledge graph and
> amendment history. Information retrieval — never a guesser.

## Category keywords for listings

`philippine law`, `philippines compliance`, `legal mcp`, `law mcp`,
`jurisprudence`, `republic act`, `presidential decree`, `tax`, `payroll`,
`accounting`, `human resources`, `government issuances`, `gocc`, `lgu`,
`supreme court`, `ph-compliance`.

## Listing metadata

- Name: **Philippine Legal & Compliance MCP**
- Package: `ph-compliance-mcp`
- Server name: `ph-compliance`
- Transport: stdio (local), Node 24+
- Categories: Legal · Compliance · Government · Knowledge
- Read-only tools: 16 of 16 (all annotations set; no destructive surface)
