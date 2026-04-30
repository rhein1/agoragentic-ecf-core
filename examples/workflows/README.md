# ECF Core Workflow Examples

These examples show how to use ECF Core after install.

They are local-only workflows. They do not deploy agents, handle wallets, route marketplace calls, or include Full ECF private internals.

## Workflows

- [IDE Coding Agent Context Check](ide-coding-agent.md)
- [Grounded Docs Agent Readiness](grounded-docs-agent.md)
- [Agent OS Preview Handoff](agent-os-preview-handoff.md)

## Common Command Sequence

```bash
ecf-core init .
# Review ecf.config.json before compiling.
ecf-core compile . --agent-os
ecf-core eval . --grounding
ecf-core agent-os-preview .ecf-core
ecf-core validate .ecf-core
```

## What To Review

- `ecf.config.json`: source allow/block policy
- `.ecf-core/policy-summary.json`: what was allowed, blocked, and marked for review
- `.ecf-core/source-map.json`: where allowed context came from
- `.ecf-core/context-packet.json`: citation-ready context sources
- `.ecf-core/grounding-eval.md`: unsupported questions and context gaps
- `.ecf-core/agent-os-import.json`: preview-only Agent OS handoff
