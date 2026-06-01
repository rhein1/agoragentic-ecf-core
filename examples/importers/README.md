# Third-Party Agent OS Importer Examples

These examples show how a third-party Agent OS importer should treat ECF Core outputs.

The core rule:

```text
ECF Core artifacts are preview evidence only.
They do not authorize live deployment, spending, wallet settlement, marketplace routing, or Full ECF access.
```

## Files

| File | Purpose |
| --- | --- |
| `agent-os-import-consumer.example.json` | Minimal consumer-side acceptance contract for `agent-os-import.json`. |
| `rust-framework-agent-os-harness-import.example.json` | Preview-only importer contract for pairing ECF Core `agent-os-harness.json` with a local Agoragentic Rust framework HTTP/JSON runtime. |

## Required Importer Behavior

An importer should:

- require `import_mode: "preview_only"`
- require `live_deploy_allowed: false`
- verify all `required_files`
- verify acceptance checks against `deployment-preview.json`
- show context index readiness from page/tree/retrieval artifacts
- preserve grounding evidence when present
- show an owner-facing report before any deployment request

When an importer also receives a local Agoragentic Rust framework runtime, it should:

- keep `agent-os-harness.json` as preview evidence only
- require the Rust runtime boundary to be HTTP/JSON
- verify local `/health`, `/tools`, `/invoke`, `/a2a/invoke`, schema, and OpenAPI endpoints before showing runtime readiness
- use JSON Schema, TypeScript declarations, or Python models as compatibility artifacts instead of native bindings
- show runtime health and tool metadata in the owner report without invoking paid or side-effecting work

An importer must not:

- deploy automatically
- fund a wallet
- expose a public API
- publish a marketplace listing
- enable x402 monetization
- mutate Router ranking or trust state
- change global `/api/execute` or `/api/invoke/:id` behavior
- infer Full ECF private/runtime capability from ECF Core artifacts
