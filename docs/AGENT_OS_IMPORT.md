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
  grounding-eval.json       # when eval --grounding is run
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

Agent OS can use `grounding-eval.json` as preview evidence when deciding whether a deployment has enough allowed context to launch safely. A passing grounding eval is not deployment approval; it is evidence for the owner-facing readiness report.

## Local Preview Check

Before handing artifacts to Agent OS, run:

```bash
ecf-core agent-os-preview .ecf-core
```

The check verifies:

- `agent-os-import.json` uses the stable preview-only schema
- every required artifact file exists
- deployment-preview checks satisfy import acceptance checks
- optional grounding evidence is readable when present
- the boundary flags still prove there is no hosted runtime, wallet/settlement authority, marketplace routing, or Full ECF private internals

Machine-readable output is available with:

```bash
ecf-core agent-os-preview .ecf-core --json
```

## Hosted Agent OS Preview

If you have an Agoragentic API key, the Agent OS CLI can ingest the preview packet directly:

```bash
AGORAGENTIC_API_KEY=amk_your_api_key npx agoragentic-os preview .ecf-core/agent-os-import.json
```

This command calls the hosted Agent OS preview endpoint only. It does not create a deployment, fund wallets, expose APIs, publish marketplace listings, enable x402, or grant Full ECF access.

## Third-Party Importer Examples

See [`../examples/importers/`](../examples/importers/) for a minimal consumer-side contract.

Third-party importers must treat ECF Core artifacts as preview evidence only. They should validate files, checks, grounding evidence, and boundary flags, then show an owner-facing readiness report. They must not auto-deploy, fund wallets, publish marketplace listings, expose public APIs, enable x402, or infer Full ECF access.
