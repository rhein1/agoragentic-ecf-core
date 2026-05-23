# ECF Core Local MCP Server

ECF Core can serve compiled `.ecf-core` artifacts over a local stdio MCP tool surface.

This is for active context serving inside IDEs and agent clients. It is read-only by default and does not call Agoragentic Cloud.

## Start

First compile artifacts:

```bash
ecf-core compile . --agent-os
ecf-core eval . --grounding
```

Then start the MCP server:

```bash
ecf-core serve-mcp .ecf-core
```

Configure that command as a local stdio MCP server in the IDE or agent client.

For Codex, generate a workspace-specific resident MCP config:

```bash
ecf-core mcp-config --target codex . --write
```

To intentionally install it into `CODEX_HOME/config.toml` or `~/.codex/config.toml`, run:

```bash
ecf-core mcp-config --target codex . --write --install-codex
```

Restart Codex after installation. Codex loads MCP servers at startup. See [`CODEX_MCP.md`](./CODEX_MCP.md).

## Tools

| Tool | Purpose |
| --- | --- |
| `ecf_core.search_context` | Rank compiled context sources for a query with deterministic semantic-lite scoring. |
| `ecf_core.get_source` | Read one compiled source record by `source_id` or `path`. |
| `ecf_core.get_policy` | Return `policy-summary.json`. |
| `ecf_core.get_manifest` | Return `manifest.json` and artifact counts. |
| `ecf_core.agent_os_preview_check` | Run the local Agent OS preview-import readiness check. |
| `ecf_core.status` | Return local resident status, artifact health, and authority boundary. |
| `ecf_core.context_pack` | Return an IDE/Codex-friendly compiled context summary without raw source content. |

## Boundary

The MCP server only reads compiled local artifacts:

- `context-packet.json`
- `source-map.json`
- `policy-summary.json`
- `manifest.json`
- Agent OS preview/import files when requested by the readiness check

It does not:

- deploy agents
- approve actions
- spend funds
- run wallet or x402 settlement
- route marketplace calls
- provision hosted Agent OS runtime
- include Full ECF private internals
- call remote model, vector, or embedding services

## Usage Pattern

Use MCP when a new IDE chat should query ECF Core without manually pasting generated files.

At the start of work, the assistant should disclose whether it is using:

- ECF Core MCP tools
- generated `.ecf-core/*` artifacts
- direct repo reads
- none of them

ECF Core MCP results are guidance and provenance. For code changes, direct source-file inspection remains the source of truth.
