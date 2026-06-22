# Context Evidence Units

Context Evidence Units are ECF Core's local, policy-aware way to turn allowed context sources into citation-backed claims for Agent OS preview. They are the evidence part of the ECF Compile Stage: sources become source maps, policy summaries, evidence units, page/tree indexes, retrieval plans, grounding evals, and preview-only Agent OS imports.

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
.ecf-core/evidence-units.json
.ecf-core/context-evidence-units.json
.ecf-core/context-compaction-report.json
```

`evidence-units.json` is the current Agent OS-facing compile-stage artifact and contains one deterministic unit per allowed context source.

`context-evidence-units.json` remains a compatibility alias for earlier consumers.

`context-compaction-report.json` summarizes duplicate claims, repeated boilerplate, citation survival, retrieval preservation, and compression ratio.

The page/tree index artifacts consume the same allowed context source set and add navigable structure for Agent OS preview:

```text
.ecf-core/page-index.json
.ecf-core/tree-index.json
.ecf-core/retrieval-plan.json
```

## Boundary

Evidence units do not authorize live deployment, tool execution, spend, wallet settlement, x402, marketplace routing, or Full ECF behavior.

They are local evidence for Agent OS preview only.

## Example Unit

```json
{
  "unit_id": "ceu_abc123",
  "source_id": "src_docs_refunds",
  "source_path": "docs/refunds.md#refund-window",
  "source_hash": "sha256...",
  "claim": "Refunds are available for 30 days after purchase.",
  "supported_answer": "Customers may request a refund within 30 days.",
  "citations": ["docs/refunds.md#refund-window"],
  "tags": ["markdown_section", "ext:md", "adapter:markdown_docs"],
  "entities": ["Refund Window", "refunds.md"],
  "policy": {
    "allowed_for_agent": true,
    "public_safe": false,
    "requires_review": false,
    "requires_public_exposure_review": true,
    "live_deploy_allowed": false
  }
}
```

`allowed_for_agent` (a local agent may read this source) is independent of
`public_safe` (the source is cleared for public export). An allowed source is
emitted with `public_safe: false` and `requires_public_exposure_review: true`,
matching the posture the context index assigns to the same source. Public
exposure stays gated until an explicit review clears it.

## Agent OS Handoff

When `ecf-core compile --agent-os` runs, the Agent OS preview/import artifacts include:

```json
{
  "evidence": {
    "evidence_units": "evidence-units.json",
    "context_evidence_units": "context-evidence-units.json",
    "context_compaction_report": "context-compaction-report.json",
    "page_index": "page-index.json",
    "tree_index": "tree-index.json",
    "retrieval_plan": "retrieval-plan.json"
  }
}
```

Agent OS may use these files during preview review to show source, evidence, and context-index readiness, but a separate owner-reviewed Agent OS launch flow is still required for live runtime.
