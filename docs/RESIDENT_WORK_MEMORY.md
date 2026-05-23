# ECF Core Resident Work Memory

ECF Core can keep local session continuity artifacts under `.ecf-core/` so IDE agents and coding assistants can restart with a durable handoff.

This is local-only work memory. It is not Full ECF, not hosted Agent OS, not a daemon, and not a deployment authority.

## Commands

Start a worklog:

```bash
ecf-core worklog begin . --goal "Add resident work memory"
```

Record progress:

```bash
ecf-core worklog checkpoint . --summary "Wired CLI and MCP read tools" --files "bin/ecf-core.js,src/work-memory.js"
```

Finish a work item:

```bash
ecf-core worklog finish . --summary "Resident memory shipped" --commit abc1234 --tests "npm test" --next-prompt "Implement the next scoped task"
```

Plan documentation updates without editing docs:

```bash
ecf-core docs-sync plan .
```

Write the next-session handoff:

```bash
ecf-core handoff . --write
```

The command is the local `handoff --write` step for new-session continuity.

## Artifacts

The resident work-memory layer writes:

```text
.ecf-core/worklog/current.json
.ecf-core/worklog/history.jsonl
.ecf-core/worklog/checkpoints.jsonl
.ecf-core/worklog/latest-summary.md
.ecf-core/docs-sync-plan.json
.ecf-core/handoff.json
.ecf-core/handoff.md
.ecf-core/next-session.md
```

These files are intended for local continuity between IDE sessions, Codex threads, and agent runs.

## Docs Sync Boundary

`ecf-core docs-sync plan` only writes a proposed docs plan. It does not auto-edit docs, apply patches, open pull requests, publish packages, deploy services, or mutate hosted systems.

If a plan says `README.md` or `ECF.md` should change, a person or coding agent must still make an explicit edit and review it.

## MCP Tools

The local MCP server exposes read-only resident memory tools:

- `ecf_core.worklog_status`
- `ecf_core.handoff`
- `ecf_core.work_memory`

These tools read `.ecf-core/` artifacts only. They do not read private Full ECF internals, customer evidence, wallet data, settlement data, hosted runtime state, or marketplace internals.

## Boundary

Resident work memory does not:

- deploy agents
- spend funds
- mutate wallets
- run x402 settlement
- publish marketplace listings
- provision hosted Agent OS runtime
- include private Full ECF internals
- auto-edit documentation

Use it to preserve context across local work sessions, then keep direct source-file inspection as the source of truth before editing code.
