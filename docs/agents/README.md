# AI Agent Integration

ph-compliance-mcp is a standard Model Context Protocol server over **stdio**.
Any MCP-capable client can connect to it — no hosted service, no API key, no
network at runtime. The corpus is downloaded once and checksum-verified on
first run (see `../ARCHITECTURE.md`).

## Supported clients (as of August 2026)

| Client | Config file | Doc | Quick start |
| --- | --- | --- | --- |
| Claude Code (Anthropic) | `.mcp.json` | [claude-code.md](claude-code.md) | `claude mcp add` |
| OpenAI Codex CLI | `config.toml` | [codex.md](codex.md) | `codex mcp add` |
| OpenCode | `opencode.json` | [opencode.md](opencode.md) | JSON `mcp` block |
| Cline (VS Code) | `mcp_settings.json` | [cline.md](cline.md) | GUI + JSON |
| Cursor | `.cursor/mcp.json` | [cursor.md](cursor.md) | `cursor mcp add` |

## The one config that matters

Every client ultimately needs the same three fields: the **command** that
launches the server, its **args**, and any **env**. For a locally built clone:

```bash
cd ph-legal-mcp
pnpm install && pnpm build
```

Then the command is:

- **Command:** `node` (or the absolute path to your node binary)
- **Args:** `["/absolute/path/to/ph-legal-mcp/dist/src/server.js"]`

or, from the repo root:

- **Command:** `pnpm`
- **Args:** `["--dir", "/absolute/path/to/ph-legal-mcp", "start"]`

Use absolute paths — clients spawn the process from arbitrary working
directories.

## Optional environment (all clients)

| Env var | Purpose |
| --- | --- |
| `PH_COMPLIANCE_CACHE_DIR` | Where corpus assets + sqlite files live (default `~/.cache/ph-compliance-mcp`) |
| `PH_COMPLIANCE_LOCAL_CORPUS` | Absolute path to a pre-built corpus dir (override download) |
| `PH_COMPLIANCE_CONFIDENCE_THRESHOLD` | 0–1 retrieval confidence gate (default 0.5) |
| `PH_COMPLIANCE_LOG_LEVEL` | `debug` / `info` / `warn` / `error` |

## Verification

1. Start the server manually once: `pnpm start` — it prints its name/version to
   stderr and serves over stdio.
2. Run the golden evals: `pnpm eval` (exit 0 = all pass).
3. In the client, ask something grounded, e.g. _search the Civil Code for the
   prescriptive period on written contracts_, then _validate the citation_.

## Tool surface (v0.7.0)

- **Retrieval:** `search_statute`, `search_jurisprudence`, `search_issuance`
- **Exact lookup:** `get_provision`, `get_case`, `get_issuance`
- **Integrity:** `cite_validate` (never guesses)
- **Deterministic compute:** `compute_prescription`, `compute_deadline`,
  `compute_13th_month`
- **Taxonomy:** `list_domains`
- **Graph (Phase 4):** `related_laws`, `related_cases`, `show_amendments`,
  `show_history`, `show_dependencies`
