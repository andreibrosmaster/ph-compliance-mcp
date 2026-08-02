# Operations Runbook (Post-Production)

This is the operations guide for running ph-compliance-mcp continuously after
deployment. It covers monitoring, backup/restore, upgrades, incident response,
and disaster recovery. Deployment models are in [enterprise.md](enterprise.md).

## Monitoring

### Health

The `scripts/healthcheck.mjs` probe spawns the server over stdio, performs the
MCP initialize handshake, calls `list_domains`, and exits 0 only when the
15-domain taxonomy is answered. Wire it to your orchestration:

- **Docker**: the image's `HEALTHCHECK` uses it (interval 30s, start-period
  15s).
- **Systemd / cron**: run `pnpm healthcheck` on a schedule; alert on exit ≠ 0.
- **Kubernetes**: `exec` into a sidecar or use a `startupProbe`/`livenessProbe`
  with the same command.

A **healthy** server answers `list_domains` with `status: ok` and 15 domains —
even with an empty corpus (empty corpora are legitimate pre-seed). An unhealthy
result means the server process, corpus files, or checksum verification is
broken.

### Corpus freshness

`scripts/check-freshness.mjs` prints the per-corpus mtime freshness the server
derives from the cached sqlite files. Alert when a corpus is older than its
cadence:

| Corpus | Expected cadence | Action if stale |
| --- | --- | --- |
| laws | weekly | run `pnpm build:corpus -- --sources official-gazette,lawphil` or manual seed refresh |
| cases | weekly | SC/CA/SB/CTA sync |
| issuances | weekly (BIR/SEC/DOLE); monthly (LGU/GOCC) | agency-specific sync |

The freshness timestamp reflects **when the corpus was built/downloaded**, not
when the law changed — treat it as "how current is our snapshot," which is
exactly the signal `list_domains` exposes to agents.

### Query telemetry

Every tool result carries a `status`: `ok`, `insufficient_corpus_coverage`,
`cannot_validate`, or `invalid_*`. Aggregate these:

- **Coverage rate** = `ok / total`. A falling rate across a domain signals
  corpus drift (law changed, corpus stale).
- **`cannot_validate` spikes** = agents are citing things the corpus can't
  confirm — investigate either the agent or the corpus.

## Backup & restore

The corpus is **immutable-ish data**: it is rebuilt from sources + seed. You
don't back it up so much as you preserve the ability to rebuild it.

1. **Back up the corpus dir** (sqlite + `.sha256` + `manifest.json`) whenever
   you distribute a verified snapshot:
   ```bash
   tar czf corpus-$(date +%Y.%m.%d).tgz -C dist/corpus laws.sqlite cases.sqlite issuances.sqlite manifest.json *.sha256
   ```
2. **Back up the seed dir** (`data-pipeline/seed/*.jsonl`) — this is
   human-curated primary-source material and is **not** regenerable from the
   internet. Commit it to git; it is the source of truth for rebuilds.
3. **Restore** = point `PH_COMPLIANCE_LOCAL_CORPUS` at a restored corpus dir;
   the loader verifies checksums and refuses to start on mismatch (so a
   corrupt backup fails loudly, never silently).
4. **Rebuild** = `pnpm build:corpus -- --sources ... --seed ... --out dist/corpus`
   reproduces a manifest-stamped corpus; compare `manifest.json` hashes against
   the published release to confirm you rebuilt the same snapshot.

## Upgrades

1. **Read the changelog** (`CHANGELOG.md`) — 0.x releases are pinned; upgrades
   are explicit.
2. **Back up** the corpus dir and seed dir (above).
3. **Build + verify** in CI: `pnpm check` (typecheck + lint + test + LOC) and
   `pnpm eval` (golden set; exit 0 = pass).
4. **Swap the binary**: rebuild `dist/`, restart the server process. The corpus
   loader re-verifies checksums on every start — a version whose checksum
   expectations changed will fail loudly rather than silently serve a stale
   corpus. If you upgraded the corpus schema, rebuild the corpus with the new
   `build-index.ts` and republish.
5. **Rollback**: keep the previous `dist/` and corpus snapshot; revert by
   swapping back. Because corpus + checksums are version-coupled, roll back
   corpus and binary together.

## Incident response

| Incident | Symptoms | Immediate action | Root fix |
| --- | --- | --- | --- |
| Checksum mismatch on start | Server refuses to load a corpus asset | Restore the last verified corpus dir | Republish correct `.sha256` in the release; check for tampering (see SECURITY.md) |
| `insufficient_corpus_coverage` everywhere | All searches return coverage status | Confirm corpus files exist and are fresh (`check-freshness`) | Refresh/populate the corpus for the affected domains |
| Server won't start | stderr shows an exception | Check `PH_COMPLIANCE_LOCAL_CORPUS` / cache dir permissions | Fix env/paths; verify Node 24 + built dist |
| Empty corpus after rebuild | `manifest.json` has 0 records | Check `--sources` adapter + seed dir | Fix adapter/seed; ensure catalog entries have https source URLs |
| Eval gate red in CI | `pnpm eval` exit 1 | Treat as release-blocking; do not ship | Fix the regression (golden answer no longer retrievable) |

## Disaster recovery

- **Loss of corpus**: rebuild from seed + `--sources` (minutes, CI-only
  network). No data loss is possible because the corpus is derived data.
- **Loss of seed data**: restore from git history (seed files are committed).
- **Loss of the repo**: the second brain (`second-brain/`) + the git history
  are the recovery point; `state.md` documents the first-run checklist.
- **RPO/RTO**: RPO ≈ last seed commit (human-curated data); RTO ≈ one corpus
  rebuild + verify cycle.

## Maintenance cadence (weekly)

1. Run `refresh-corpus.yml` (or the manual equivalent) and confirm
   `manifest.json` version bump + checksum publish.
2. Run `pnpm eval:all`; investigate any red pair.
3. Review `pnpm audit --prod`; upgrade pinned deps when advisories appear.
4. Update `CHANGELOG.md` with any corpus version bumps.
5. Log the run in the second brain session log.
