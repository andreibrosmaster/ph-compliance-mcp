# Claude Code

Claude Code connects to MCP servers declared in **`.mcp.json`** at the project
root (project scope) or via the `claude mcp add` CLI. As of August 2026,
`.mcp.json` uses the `mcpServers` schema with stdio entries.

## Quick start (CLI)

```bash
cd /path/to/your/project
claude mcp add ph-compliance -- node /abs/path/ph-legal-mcp/dist/src/server.js
claude mcp list                      # verify
```

Scopes: `--scope user` (all projects), `--scope project` (this project),
`--scope local` (this machine only).

## Project `.mcp.json`

```json
{
  "mcpServers": {
    "ph-compliance": {
      "command": "node",
      "args": ["/abs/path/ph-legal-mcp/dist/src/server.js"],
      "env": {
        "PH_COMPLIANCE_CONFIDENCE_THRESHOLD": "0.5"
      }
    }
  }
}
```

Or via pnpm (no build step needed if you prefer tsx, slower startup):

```json
{
  "mcpServers": {
    "ph-compliance": {
      "command": "pnpm",
      "args": ["--dir", "/abs/path/ph-legal-mcp", "start"]
    }
  }
}
```

## Using it

Claude Code auto-discovers the tools. Ask grounded questions and it will chain
`search_statute` → `get_provision` → `cite_validate`. For legal work, always
end with `cite_validate` so the final answer cites corpus-resolved text.

```text
Check whether a written contract claim filed 12 years after breach is
prescribed, then validate the underlying citation.
```

Claude will compute the period (`compute_prescription`), pull the provision
(`get_provision`), and validate (`cite_validate`).

## Troubleshooting

- `claude mcp list` shows connection status; `claude mcp get ph-compliance`
  shows details.
- The server logs to stderr — run `claude mcp doctor` or check the session
  transcript if a tool call times out.
- First run downloads the corpus; allow a minute on a cold cache.
