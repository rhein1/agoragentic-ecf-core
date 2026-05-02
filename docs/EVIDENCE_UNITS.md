# Context Evidence Units

Context Evidence Units are ECF Core's local, policy-aware way to turn allowed context sources into citation-backed claims for Agent OS preview.

They are original ECF artifacts, not a clone of another project's data model. They stay JSON-first, source-map aware, and deployment-safety oriented.

## Purpose

Raw files and naive chunks are often too messy for agent deployment review. ECF Core now emits structured evidence units so a builder can inspect:

- which source supports a claim
- what answer the source can safely support
- which citation survives the transformation
- whether the unit is allowed for an agent
- whether live deployment is still disabled

## Artifacts

```text
.ecf-core/context-evidence-units.json
.ecf-core/context-compaction-report.json
```

`context-evidence-units.json` contains one deterministic unit per allowed context source.

`context-compaction-report.json` summarizes duplicate claims, repeated boilerplate, citation survival, retrieval preservation, and compression ratio.

## Boundary

Evidence units do not authorize live deployment, tool execution, spend, wallet settlement, x402, marketplace routing, or Full ECF behavior.

They are local evidence for Agent OS preview only.

## Example Unit

```json
{
  "unit_id": "ceu_abc123",
  "source_id": "src_docs_refunds",
  "source_path": "docs/refunds.md#refund-window",
  "claim": "Refunds are available for 30 days after purchase.",
  "supported_answer": "Customers may request a refund within 30 days.",
  "citations": ["docs/refunds.md#refund-window"],
  "policy": {
    "allowed_for_agent": true,
    "public_safe": true,
    "requires_review": false,
    "live_deploy_allowed": false
  }
}
```

## Agent OS Handoff

When `ecf-core compile --agent-os` runs, the Agent OS preview/import artifacts include:

```json
{
  "evidence": {
    "context_evidence_units": "context-evidence-units.json",
    "context_compaction_report": "context-compaction-report.json"
  }
}
```

Agent OS may use these files during preview review, but a separate owner-reviewed Agent OS launch flow is still required for live runtime.

