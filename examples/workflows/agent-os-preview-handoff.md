# Agent OS Preview Handoff

Goal: prepare local ECF Core evidence for an Agent OS deployment preview without authorizing live deployment.

## Use This When

- a builder wants to see whether a local repo, docs folder, or small data source is ready for Agent OS
- the agent needs a source map and policy summary before deployment
- grounding evidence should be reviewed before any hosted runtime is considered

## Steps

```bash
ecf-core init .
# Review ecf.config.json before compiling.
ecf-core compile . --agent-os
ecf-core eval . --grounding
ecf-core agent-os-preview .ecf-core --json
ecf-core validate .ecf-core
```

## Expected Outputs

```text
.ecf-core/
  context-packet.json
  source-map.json
  policy-summary.json
  deployment-preview.json
  agent-os-harness.json
  agent-os-handoff.json
  agent-os-import.json
  eval-report.json
  grounding-eval.json
```

## Review Checklist

- `agent-os-import.json` has `import_mode: "preview_only"`.
- `live_deploy_allowed` is `false`.
- `agent-os-preview` reports `boundary_safe: true`.
- Grounding eval is either `pass` or has clear unsupported context gaps.
- No `.env`, secrets, local databases, binaries, or generated artifacts were included.

## Boundary

The output is not a live deployment request.

Agent OS must still run a separate owner-reviewed launch flow with policy checks, runtime provisioning, billing/spend authorization, and launch gates.
