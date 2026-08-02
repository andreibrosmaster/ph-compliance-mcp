# Governance & Contribution Model

ph-compliance-mcp follows an enterprise-grade contribution model: protected
mainline, mandatory reviews on law-touching paths, automated dependency
management, and hard CI/release gates. This page describes the machinery; the
workflow itself is in [CONTRIBUTING.md](../CONTRIBUTING.md) and the release
process in [release.md](release.md).

## Branch model

- `main` is the protected trunk. All changes land via **pull requests** —
  no direct pushes.
- Long-running work uses short-lived feature branches off `main`.
- Releases are **tags** (`v0.8.0` for code, `corpus-YYYY.MM.DD` for corpus),
  never branches.

## Required reviews

`.github/CODEOWNERS` enforces mandatory review on legal-accuracy-sensitive
paths:

- `src/tools/`, `src/retrieval/`, `src/resources/`, `data-pipeline/`,
  `data-pipeline/catalog.ts`, `data-pipeline/normalizers/`,
  `src/db/schema/` — **any change here is a law-adjacent change** and needs a
  maintainer review. A wrong retrieval result or a fabricated catalog entry is
  a legal-integrity defect, not a code nit.
- `evals/` — a wrong golden "answer" silently weakens the release gate.
- `.github/`, `Dockerfile` — CI/release integrity.

Branch protection (to be enabled on the GitHub repo when created):
- Require PR reviews (1 for docs-only, 2 for law-adjacent paths via CODEOWNERS).
- Require status checks: `validate`, `build`, `eval` from `ci.yml`.
- Require up-to-date branches before merging.
- Block force-pushes on `main`.

## Automated dependency management

`.github/dependabot.yml` opens weekly PRs for `npm` (grouped by ecosystem:
MCP SDK, zod, TS tooling) and `github-actions`. Policy:

- `better-sqlite3` majors above the verified baseline (v12.4.1 on Node 24,
  ABI 137 prebuild) are ignored by default — they need a runtime +
  native-rebuild verification (see `SECURITY.md` dependency policy).
- `pnpm audit --prod` runs in `ci.yml` and the `release.yml` release-gates job;
  **high/critical findings fail the build/release**.

## CI gates

`ci.yml` runs on every push/PR:

| Job | Gate |
| --- | --- |
| `validate` | typecheck + lint + test + LOC budget + `pnpm audit --prod` |
| `build` | corpus build smoke (validates pipeline wiring) |
| `eval` | golden-set harness (`pnpm eval:all`); exit 1 (regression) fails, exit 2 (corpus unpopulated) is non-blocking until the corpus is seeded |

`release.yml` runs the same gates in a `release-gates` job that **must pass
before `build-corpus` publishes assets** — a release can never ship a
regression or a vulnerable dependency tree.

## Triage & labeling

`.github/workflows/auto-label.yml` + `.github/labeler.yml` assign area labels
to PRs from changed paths (`area: core-server`, `area: tools`, `area: domains`,
`area: pipeline`, `area: corpus`, `area: evals`, `area: ci`, `area: docs`,
`area: docker`, `area: agents`). Issues use the templates in
`.github/ISSUE_TEMPLATE/`; discussions use `.github/DISCUSSION_TEMPLATE.md`.

## Ownership & security

- `SECURITY.md` defines the trust model, hardening checklist, and the
  vulnerability-reporting path (private reporting, 5-business-day response).
- `CODE_OF_CONDUCT.md` governs community conduct.
- Sensitive paths carry CODEOWNERS review so no single contributor can merge
  law-adjacent changes unreviewed.

## Decision records

Architectural decisions are ADRs in `docs/adr/` (ADR-000 scope, ADR-002
FTS5-first, ADR-004 rename+scope). Any further domain or transport addition is
ADR-gated (`second-brain/roadmap.md` Phase 8).
