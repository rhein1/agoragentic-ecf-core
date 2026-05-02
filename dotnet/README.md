# ECF Core for .NET

ECF Core for .NET is an artifact-compatible .NET lane for C#, ASP.NET Core, EF Core, and Semantic Kernel-style projects.

It produces and consumes the same `.ecf-core/` artifacts as the Node ECF Core CLI:

- `context-packet.json`
- `source-map.json`
- `policy-summary.json`
- `manifest.json`
- `deployment-preview.json`
- `agent-os-handoff.json`
- `agent-os-harness.json`
- `agent-os-import.json`
- `eval-report.json`
- `grounding-eval.json`

## Boundary

This is not Full ECF, not hosted Agent OS, and not an enterprise/audit product.

The .NET lane is allowed to inspect local .NET project structure, redact sensitive configuration, generate preview-only Agent OS artifacts, and run local validation/eval scaffolding.

It must not include hosted provisioning, wallet settlement, x402 execution, marketplace routing, tenant isolation, private connectors, enterprise audit internals, or Full ECF private runtime behavior.

## Packages

```text
src/Agoragentic.EcfCore
  Artifact DTOs, JSON load/save helpers, and artifact validation.

src/Agoragentic.EcfCore.DotNet
  Local .NET scanners and default .NET safety policy.

src/Agoragentic.EcfCore.Cli
  `ecfnet` local CLI scaffold.
```

## CLI

```bash
ecfnet init
ecfnet compile --agent-os
ecfnet eval --grounding
ecfnet validate
ecfnet export --agent-os
```

All generated Agent OS artifacts are preview-only. Live deployment remains a separate Agent OS owner-reviewed launch flow.
