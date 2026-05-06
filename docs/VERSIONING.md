# Versioning And Compatibility

ECF Core uses semantic versioning.

## Package Versions

- Patch releases fix bugs without changing artifact shape.
- Minor releases add optional fields, adapters, commands, or reports.
- Major releases may change required fields or remove deprecated fields.

## Stable 1.0 Contract

Starting with `1.0.0`, these artifact schemas are stable:

- `ecf-core.context-packet.v1`
- `ecf-core.source-map.v1`
- `ecf-core.policy-summary.v1`
- `ecf-core.local-config.v1`
- `ecf-core.connector-adapter.v1`
- `ecf-core.agent-os-handoff.v1`
- `ecf-core.agent-os-harness.v1`
- `ecf-core.deployment-preview.v1`
- `ecf-core.eval-report.v1`
- `ecf-core.agent-os-import.v1`
- `ecf-core.agent-os-preview-check.v1`
- `ecf-core.grounding-eval.v1`
- `ecf-core.evidence-units.v1`
- `ecf-core.context-evidence-units.v1`
- `ecf-core.context-compaction-report.v1`
- `ecf-core.page-index.v1`
- `ecf-core.tree-index.v1`
- `ecf-core.retrieval-plan.v1`

Stable means existing required fields remain compatible within the same major package line. New optional fields may be added in minor releases.

## 1.1 Additions

`1.1.x` adds optional semantic-lite retrieval scoring, compression experiment metrics, and the `ecf-core agent-os-preview` readiness command. These additions do not change existing required fields in the stable `v1` artifact schemas.

## 1.2 Additions

`1.2.x` adds the optional local grounding eval loop and `ecf-core.grounding-eval.v1`. Existing compile, eval, and Agent OS preview artifacts remain preview-only and do not authorize live deployment.

## 1.3 Additions

`1.3.x` adds optional ranking provider contracts for deterministic `local_vector` scoring plus precomputed-result hooks for Qdrant, Chroma, GitNexus/code graph, and MCP context providers. These adapters remain dependency-free by default and fall back to built-in semantic-lite ranking when external results are not supplied.

## 1.4 Additions

`1.4.x` adds deterministic local page/tree context index artifacts and retrieval-plan metadata. The public package emits `page-index.json`, `tree-index.json`, and `retrieval-plan.json` for Agent OS preview readiness without adding OCR/VLM dependencies, hosted RAG, vector databases, wallet settlement, marketplace routing, or Full ECF internals.

## Compile-Stage Evidence Addition

The compile-stage artifact set now emits `evidence-units.json` with schema `ecf-core.evidence-units.v1` as the clean Agent OS-facing evidence file. `context-evidence-units.json` remains readable as a compatibility alias within the same major package line.

## Migration Policy

When a future artifact version is introduced:

1. The previous version remains readable for at least one major release.
2. A migration note is added to this file.
3. `ecf-core validate` continues to report clear schema-version failures.
4. Breaking changes require a major package version.

## Boundary

Version stability applies to local/self-hosted ECF Core artifacts only.

It does not imply hosted Agent OS runtime access, wallet settlement, marketplace routing, Full ECF private internals, SOC 2 compliance, or an enterprise support contract.
