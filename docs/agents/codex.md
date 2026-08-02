# OpenAI Codex CLI

The Codex CLI (the `codex` binary) declares MCP servers in **`config.toml`**
under `[mcp_servers.NAME]` sections. As of August 2026, the `codex mcp add`
command writes these entries for you.

## Quick start (CLI)

```bash
codex mcp add ph-compliance -- node /abs/path/ph-legal-mcp/dist/src/server.js
codex mcp list
```

## Manual `config.toml`

`~/.codex/config.toml` (user) or `./config.toml` (project):

```toml
[mcp_servers.ph-compliance]
command = "node"
args = ["/abs/path/ph-legal-mcp/dist/src/server.js"]
env = { PH_COMPLIANCE_CONFIDENCE_THRESHOLD = "0.5" }
```

Or via pnpm:

```toml
[mcp_servers.ph-compliance]
command = "pnpm"
args = ["--dir", "/abs/path/ph-legal-mcp", "start"]
```

## Using it

Codex surfaces the tools as ordinary functions. For compliance questions it
works best to name the corpus you expect:

```text
Using the Philippine compliance MCP, list the exclusions to 13th-month pay
under PD 851 and cite the source.
```

Codex will call `search_statute`/`search_issuance`, pull exact text with
`get_provision`, and (for a good answer) run `cite_validate`.

## Troubleshooting

- `codex mcp list` shows registered servers and enabled state.
- If a tool errors, the raw server stderr appears in the Codex debug log
  (`codex --debug`).
- The server is local-only stdio; no network egress is required at runtime.
