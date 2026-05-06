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

## Required Importer Behavior

An importer should:

- require `import_mode: "preview_only"`
- require `live_deploy_allowed: false`
- verify all `required_files`
- verify acceptance checks against `deployment-preview.json`
- show context index readiness from page/tree/retrieval artifacts
- preserve grounding evidence when present
- show an owner-facing report before any deployment request

An importer must not:

- deploy automatically
- fund a wallet
- expose a public API
- publish a marketplace listing
- enable x402 monetization
- infer Full ECF private/runtime capability from ECF Core artifacts
