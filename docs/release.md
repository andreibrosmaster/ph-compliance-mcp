# Release Process

ph-compliance-mcp has two independently versioned artifacts:

1. **Code releases** (`v0.8.0`, …) — the server, tools, pipeline, docs.
2. **Corpus releases** (`corpus-2026.08.02`, …) — the built sqlite assets +
   checksums + manifest, published to GitHub Releases and downloaded by
   `corpus-loader.ts` at runtime.

## Versioning

- **Code**: semver (`vMAJOR.MINOR.PATCH`). The server reports `SERVER_VERSION`
  in `src/config.ts`; keep it in sync with the CHANGELOG top entry.
- **Corpus**: calendar stamp `YYYY.MM.DD` (default stamp from
  `build-index.ts`), recorded in `manifest.json`. A corpus rebuild is a new
  stamp even when code is unchanged — corpus and code are version-coupled
  (checksums + schema) and should be released together when the schema changed.

## Release gates (all must pass)

```bash
pnpm typecheck     # no TS errors
pnpm lint          # eslint clean
pnpm test          # vitest suite (pipeline, retrieval, tools, manifest)
pnpm check:loc     # LOC budget
pnpm eval:all      # golden sets pass (exit 0); exit 2 = corpus unpopulated, not a regression
pnpm audit --prod  # no high/critical advisories
```

The eval gate is **release-blocking**: a golden answer that stops being
retrievable is a regression, not a flake.

## Code release steps

1. Update `CHANGELOG.md` (Keep a Changelog format), `SERVER_VERSION` in
   `src/config.ts`, and the second brain (roadmap/state/session log).
2. Open a PR; CI runs the full gate suite.
3. Merge, then tag: `git tag v0.8.0 && git push origin v0.8.0`.
4. `release.yml` builds the corpus, generates `.sha256` for each sqlite asset,
   and publishes to GitHub Releases under the `v*` tag. The checksum step is
   **load-bearing** (blueprint §17) — `corpus-loader.ts` refuses to start on
   mismatch, so never publish a release without the `.sha256` files.
5. Verify: `pnpm install` on a clean machine, `pnpm healthcheck` exit 0.

## Corpus release steps (refresh cadence)

1. `refresh-corpus.yml` runs weekly (or via `workflow_dispatch`): builds with
   `--sources official-gazette,lawphil --seed data-pipeline/seed --out dist/corpus
   --since <last month>`.
2. It verifies checksums, writes `manifest.json`, tags `corpus-YYYY.MM.DD`,
   and publishes sqlite + `.sha256` + `manifest.json` to the release.
3. Confirm the manifest records nonzero record counts for non-empty corpora;
   a manifest with 0 records is a red flag (adapter/seed problem), not a
   release.

## Rollback

- Keep the previous `dist/` and the previous corpus snapshot. Restore both
  together (they are checksum/schema-coupled).
- Because the corpus is derived data, "rollback" usually means "rebuild from
  seed + sources with the previous code" rather than restoring binaries.

## Post-release checklist

- [ ] GitHub release has `laws.sqlite` + `.sha256` (or an explicit empty-corpus note)
- [ ] `manifest.json` published with the corpus
- [ ] `pnpm eval:all` green on the tagged commit
- [ ] CHANGELOG + second brain updated
- [ ] Ops runbook (`docs/operations.md`) reviewed for the new cadence
