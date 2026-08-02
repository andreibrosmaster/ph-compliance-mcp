# OpenCode

OpenCode (opencode.ai) declares MCP servers in the **`mcp`** section of
`opencode.json` (project) or `~/.config/opencode/opencode.json` (global). As of
August 2026, local servers use `type: "local"` with `command` as an argv array.

## `opencode.json`

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "ph-compliance": {
      "type": "local",
      "command": ["node", "/abs/path/ph-legal-mcp/dist/src/server.js"],
      "enabled": true,
      "environment": {
        "PH_COMPLIANCE_CONFIDENCE_THRESHOLD": "0.5"
      }
    }
  }
}
```

`command` is a full argv array — put the binary and every argument in one
list. `environment` maps to the process env; `enabled: false` disables without
deleting the entry.

## Using it

OpenCode auto-discovers the tools. Ask a grounded compliance question and it
chains search → exact lookup → validation. Example:

```text
Compute the last day to file a motion for reconsideration if notice was
served on 2026-08-02 (treating 2026-08-30 as a holiday).
```

OpenCode will use `compute_deadline`, then confirm the rule with
`get_provision`.

## Troubleshooting

- `opencode` prints MCP connection errors on startup; check the `mcp` block
  spelling (type must be `local`, not `stdio`).
- Restart OpenCode after editing `opencode.json`.
- Server stderr is surfaced in OpenCode's logs under `~/.local/share/opencode/log`.
