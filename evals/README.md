# Evals

Golden evaluation sets for the ph-compliance-mcp retrieval layer (blueprint §14,
mcp-builder skill Phase 4) plus a working harness (`run-eval.ts`, Phase 5).

## Layout

- `golden/evaluation.xml` — core-corpus golden set (Constitution, Civil Code,
  Family Code, Revised Penal Code).
- `golden/evaluation-compliance.xml` — ADR-004 compliance-domain set (labor,
  payroll, tax, HR, business-transactional, accounting, special laws).
- `run-eval.ts` — harness that spawns the **real server over stdio** and scores
  each pair.

## Format

Each `qa_pair` carries the question, a single stable verifiable answer, and an
optional retrieval `<plan>`:

```xml
<evaluation>
  <qa_pair>
    <question>…</question>
    <answer>…</answer>
    <plan>
      <tool name="search_statute" args='{"query":"…", "limit": 5}'/>
      <tool name="get_provision" args='{"statute":"…","provision":"…"}'/>
    </plan>
  </qa_pair>
</evaluation>
```

A pair passes when the normalized answer appears in the text returned by the
plan's tool calls against the live server. Pairs without a `<plan>` fall back
to searching the question across all three corpora.

## Running

```bash
pnpm build                      # build dist/src/server.js first
pnpm eval                       # core golden set
pnpm eval -- --golden evals/golden/evaluation-compliance.xml
pnpm eval:all                   # both sets
```

Exit codes: `0` all pass · `1` real regressions · `2` coverage-blocked
(corpus not yet populated) or harness/server failure. Use `--skip-coverage-exit`
to treat an empty corpus as success.

## Requirements (per evaluation.md)

Each question must be: **independent**, **read-only**, **complex** (multiple
tool calls: search → get_provision / get_issuance / get_case / cite_validate),
**realistic**, **verifiable** by string comparison, and **stable** over time.

## Status

- **Harness**: working (Phase 5). Spawns the server via the MCP SDK Client over
  stdio and scores matches; distinguishes regressions from missing corpus
  coverage.
- **Core golden set**: 10 pairs, passable once the core corpus is seeded.
- **Compliance golden set**: 10 pairs across the ADR-004 domains, passable once
  the compliance corpus (labor/payroll/tax/HR/business/accounting) is seeded.
- Eval categories tracked in `../../second-brain/roadmap.md` → "Eval matrix":
  retrieval accuracy, citation accuracy, amendment detection, version
  correctness, corpus freshness, hallucination resistance.
