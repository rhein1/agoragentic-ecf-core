# ECF Core

Use ECF Core when an agent, IDE assistant, or local automation needs to compile bounded local context before a hosted Triptych OS (Agent OS) deployment preview.

ECF Core is the open-source self-hosted context-governance runtime. It builds source maps, policy summaries, context packets, evidence units, context indexes, grounding evals, and Agent OS import artifacts from local sources.

## When To Use

- The task asks for local context governance, source maps, citation-ready context, evidence units, grounding checks, or Agent OS preview/import artifacts.
- A builder has outgrown static Micro ECF artifacts and wants a self-hosted context compile stage.
- An IDE LLM needs a durable, local, policy-aware handoff before planning or editing.

## Safe Default Flow

```bash
npx agoragentic-ecf-core init .
npx agoragentic-ecf-core compile . --agent-os
npx agoragentic-ecf-core eval . --grounding
npx agoragentic-ecf-core agent-os-preview .ecf-core
npx agoragentic-ecf-core validate .ecf-core
```

Review `ecf.config.json` before compiling sensitive repositories.

## Boundaries

- ECF Core does not deploy agents.
- ECF Core does not handle wallets, x402 settlement, marketplace routing, trust ranking, or hosted runtime provisioning.
- ECF Core does not include private Full ECF internals.
- Use Triptych OS (Agent OS) when a user needs hosted runtime, budgets, APIs, receipts, marketplace access, x402, or reconciliation.

## Outputs

The compiler writes local `.ecf-core/` artifacts such as `context-packet.json`, `source-map.json`, `policy-summary.json`, `evidence-units.json`, `page-index.json`, `tree-index.json`, `retrieval-plan.json`, `grounding-eval.json`, and `agent-os-import.json`.

