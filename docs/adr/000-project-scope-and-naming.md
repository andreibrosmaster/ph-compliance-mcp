# ADR-000: Project Scope & Naming

- **Status:** Accepted
- **Date:** 2026-08-02
- **Deciders:** project lead (consolidation of v1 blueprint + external recommendation set)

## Context

Two documents inform this decision:

1. **v1 blueprint** (Aug 2, 2026): an 11-domain PH legal MCP, phase-gated
   rollout, with an explicit risk-register entry against scope creep — *"Scope
   creep across 10+ legal domains stalls the whole project → mitigation:
   phase-gated rollout starting with 4 highest-value domains."*
2. **External recommendation set ("doc2")**, proposing, among other things, a
   rename to *"Philippine Compliance MCP"* with 30+ domains (SEC, BSP, NPC, COA,
   GSIS, SSS, PhilHealth, Pag-IBIG, customs, immigration, cooperative law,
   procurement, ...) — introduced with no phase gating at all.

The rename proposal is roughly 3x the surface area of the already-ambitious
11-domain taxonomy, with no sequencing. Its own stated philosophy ("avoid scope
creep") directly collides with its own recommendation.

## Decision

- Keep the codename **`ph-legal-mcp`** and the **11-domain V1 taxonomy**.
- Keep the domain-plugin architecture (blueprint §4/§8), which lets any future
  domain be added later **without a rename or an upfront scope commitment**.
- Treat the compliance-platform vision as a **documented direction, not a
  commitment**: domain expansion and a rename are Phase 8+ decisions, evaluated
  one domain at a time against the same pipeline-proof gate the first four
  domains went through.

## Consequences

- Phase 1–6 scope is locked; mid-project "compliance platform" framing is out of scope.
- The rename stays cheap later — ADR-000 is what makes the deferred decision affordable.
- Contributors get clarity: the legal-retrieval core ships first; compliance
  breadth is a later, gated phase.

## Alternatives considered

- Rename now + 30+ domains (rejected: scope explosion, no gating, stalls delivery).
- Rename now + 11 domains (rejected: churn with no functional benefit).
