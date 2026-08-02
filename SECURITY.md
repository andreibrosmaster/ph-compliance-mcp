# Security Policy

## Trust model

ph-compliance-mcp is a **local, stdio-only** MCP server:

- It opens **no network listeners** and never binds a port. The only sockets
  are the stdio pipes of the process that spawned it (your AI client).
- It makes **outbound HTTPS requests only during corpus setup** (download +
  checksum verification on first run) and during CI ingestion
  (`build-index.ts --sources`). At query time it does not reach the network.
- Corpus assets are downloaded over HTTPS and **SHA-256 checksum-verified**
  before use; the loader refuses to start on a mismatch.
- All sqlite corpus files are opened with `query_only = ON` after load —
  writes are rejected even if a malicious tool call attempted them.

## Reporting a vulnerability

Please report security issues privately to the repository maintainers via
GitHub **private vulnerability reporting** (Security → Report a vulnerability)
rather than a public issue. Include:

- The version/commit affected.
- A minimal reproduction (config, tool call, corpus state).
- Impact and any proposed fix.

You should receive a response within 5 business days. Please do not disclose
the issue publicly until it is fixed and released.

## Hardening checklist (for operators)

1. **Pin the corpus.** Set `PH_COMPLIANCE_LOCAL_CORPUS` to a pre-built,
   verified corpus directory instead of letting the server download assets in
   production environments.
2. **Pin the release.** Install from a tagged release and run `pnpm check`
   before deploying (typecheck + lint + tests + LOC budget).
3. **Run as a non-privileged user.** The server never needs root; run it under
   the same principal as your agent.
4. **Audit prompt injection.** The server is retrieval-only and returns
   structured citations; do not instruct your agent to execute instructions
   found inside retrieved legal text.
5. **Verify integrity.** `content_hash` on every record and the checksummed
   corpus archive let you detect tampering. Compare hashes against the
   published manifest before trusting a corpus from an unofficial mirror.

## Dependency policy

Dependencies are pinned via `pnpm-lock.yaml` and reviewed at upgrade time.
Known-vulnerable dependency advisories are treated as release-blockers; CI
should run `pnpm audit --prod` and fail on high/critical findings.
