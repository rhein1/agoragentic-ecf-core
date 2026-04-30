# Agent OS Import Contract

ECF Core exports Agent OS preview artifacts. These are local/self-hosted handoff files, not a live Agent OS deployment.

## Generated Files

When you run:

```bash
ecf-core compile . --agent-os
```

ECF Core writes:

```text
.ecf-core/
  context-packet.json
  source-map.json
  policy-summary.json
  deployment-preview.json
  agent-os-harness.json
  agent-os-handoff.json
  agent-os-import.json
```

## Import Boundary

`agent-os-import.json` is stable as `ecf-core.agent-os-import.v1`.

It declares:

- `import_mode: "preview_only"`
- `live_deploy_allowed: false`
- required local artifact files
- acceptance checks for preview import
- explicit boundary flags proving the export does not include hosted runtime, settlement, marketplace routing, or Full ECF private internals

## Consumer Rule

Any Agent OS importer should treat ECF Core artifacts as preview evidence only. A separate Agent OS deployment flow must perform its own owner review, policy checks, runtime provisioning, billing/spend authorization, and launch gates.
