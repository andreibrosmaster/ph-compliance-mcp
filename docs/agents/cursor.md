# Cursor

Cursor connects to MCP servers via **`.cursor/mcp.json`** at the project root
or the global `~/.cursor/mcp.json`. As of August 2026 the `cursor mcp add`
command also works.

## Quick start (CLI)

```bash
cursor mcp add ph-compliance -- node /abs/path/ph-legal-mcp/dist/src/server.js
cursor mcp list
```

## `.cursor/mcp.json`

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

Or via pnpm:

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

Cursor surfaces the tools in chat (they appear under **MCP tools** in the
model picker). Ask grounded questions:

```text
Check if our standard employment contract's 6-month probation period and
termination clause comply with the Labor Code, citing the provisions.
```

Cursor will search the labor domain, pull provisions, and validate citations.

## Troubleshooting

- Use absolute paths for the server script.
- After editing `.cursor/mcp.json`, reload the window or toggle the MCP
  server off/on in **Settings → MCP**.
- The server is local stdio; Cursor never sends your corpus to the network.
