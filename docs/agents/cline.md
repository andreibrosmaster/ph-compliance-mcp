# Cline (VS Code)

Cline manages MCP servers through its settings UI, backed by
**`mcp_settings.json`** in the VS Code extension's global storage:

```
%APPDATA%/Code/User/globalStorage/saoudrizwan.claude-dev/settings/mcp_settings.json
```

(On macOS/Linux the equivalent is under `~/Library/Application Support/Code/User/...`
or `~/.config/Code/User/...`.)

## Via the UI (recommended)

1. Open Cline → MCP Servers → **Edit Configurations**.
2. Add a **stdio** server:
   - **Name:** `ph-compliance`
   - **Command:** `node` (or `pnpm`)
   - **Arguments:** `["/abs/path/ph-legal-mcp/dist/src/server.js"]`
     (or `["--dir", "/abs/path/ph-legal-mcp", "start"]` for pnpm)
3. Save; Cline auto-refreshes the connection (green = connected).

## Via `mcp_settings.json`

```json
{
  "mcpServers": {
    "ph-compliance": {
      "command": "node",
      "args": ["/abs/path/ph-legal-mcp/dist/src/server.js"],
      "env": {
        "PH_COMPLIANCE_CONFIDENCE_THRESHOLD": "0.5"
      },
      "disabled": false,
      "autoApprove": []
    }
  }
}
```

## Using it

Cline lists the tools under its MCP section. Because Cline works on your local
workspace, it pairs naturally with repo-local legal work (contract review,
compliance checks). Always ask for a citation and Cline will finish with
`cite_validate`.

## Troubleshooting

- Status dots: green = connected, yellow = connecting, red = error. Click to
  see the error (usually a wrong path or a failed first-run corpus download).
- Use **absolute** command paths on Windows (`node` resolves via PATH, but the
  server script path must be absolute).
- After upgrading ph-compliance, restart the MCP server from the UI to reload.
