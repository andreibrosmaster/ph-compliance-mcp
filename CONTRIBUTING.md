# Contributing

Phase-gated project — see [`../second-brain/roadmap.md`](../second-brain/roadmap.md)
for what is currently being built.

## Before contributing

1. Read ADR-000 (scope), ADR-002 (FTS5-first), ADR-004 (rename + compliance
   scope), and `../second-brain/state.md`.
2. Work within the **active phase**. Scope changes are proposed as ADRs, not
   unplanned code.
3. Use the `ph-compliance` identity everywhere — never introduce new `ph-legal`
   strings (see `docs/seo.md` and `AGENTS.md` rule 2).

## Standards

- Every change: typecheck + tests + lint; update `CHANGELOG.md` and the session log.
- Every new architectural decision gets an ADR in `docs/adr/`.
- Keep modules small: warn >220 LOC, flag >350 (`scripts/check-loc-budget.mjs`).
- Retrieval changes must not regress the eval suite (`evals/`) — CI runs it as
  the `eval` gate; a golden-pair regression fails the build.
- Public-surface changes (tools, domains, resources): keep `README.md`,
  `llms.txt`, and `docs/seo.md` in sync — they are the GEO/SEO surface.
- Law-adjacent paths (`src/tools/`, `src/retrieval/`, `data-pipeline/`,
  `evals/`) require maintainer review per `.github/CODEOWNERS` — a wrong
  retrieval result is a legal-integrity defect, not a code nit.

## Process (enterprise model — see `docs/governance.md`)

- All changes land via pull requests on `main`; no direct pushes.
- CI (`ci.yml`) must be green: `validate` (typecheck/lint/test/LOC/audit),
  `build` (corpus smoke), `eval` (golden gate). `pnpm audit --prod` failures
  are release-blocking.
- Dependencies update via Dependabot (`.github/dependabot.yml`), not ad-hoc
  version bumps; review the grouped PRs like any other change.
- Releases run `release-gates` before publishing assets (`release.yml`).

## Deferred (Phase 6)

Logo, GitHub Pages mirror, verified `npx github:<owner>/<repo>` install path.
(CODE_OF_CONDUCT.md, SECURITY.md, issue/PR templates, DISCUSSION_TEMPLATE.md,
and auto-labeling are already in place.)
