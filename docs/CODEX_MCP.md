# ECF Core Resident MCP for Codex

ECF Core can generate a workspace-specific Codex MCP server entry. This makes compiled ECF Core context available to new Codex sessions after Codex restarts.

## Generate The Config

```bash
ecf-core mcp-config --target codex . --write
```

This writes:

```text
.ecf-core/codex-mcp.toml
.ecf-core/codex-mcp.json
.ecf-core/CODEX_MCP_INSTALL.md
```

## Install Into Codex

Only run this when you intentionally want to update the local Codex config:

```bash
ecf-core mcp-config --target codex . --write --install-codex
```

The command updates `CODEX_HOME/config.toml` or `~/.codex/config.toml` with a marked block for this workspace. Restart Codex after installation; MCP servers are loaded at startup.

## Resident Tools

The generated server exposes:

- `ecf_core.status`
- `ecf_core.context_pack`
- `ecf_core.search_context`
- `ecf_core.get_source`
- `ecf_core.get_policy`
- `ecf_core.get_manifest`
- `ecf_core.agent_os_preview_check`
- `ecf_core.worklog_status`
- `ecf_core.handoff`
- `ecf_core.work_memory`

Resident work memory can be refreshed before a restart with:

```bash
ecf-core worklog checkpoint . --summary "current progress"
ecf-core docs-sync plan .
ecf-core handoff . --write
```

## Boundary

The resident MCP server is local-only. It reads compiled ECF Core artifacts and does not deploy, spend, mutate wallets, settle x402, publish marketplace listings, route marketplace calls, provision hosted Agent OS runtime, or expose Full ECF private internals.

`docs-sync plan` writes only a local plan. It does not auto-edit documentation unless a future explicit apply command is added and run intentionally.
