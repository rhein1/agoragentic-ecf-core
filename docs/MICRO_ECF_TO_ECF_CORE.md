# Micro ECF To ECF Core

Micro ECF and ECF Core should work together without becoming the same product.

## Micro ECF

Micro ECF is the smallest developer wedge.

It creates:

- `ECF.md`
- `AGENTS.md`
- `MICRO_ECF_LLM_BOOTSTRAP.md`
- `.micro-ecf/policy.json`
- source maps
- policy summaries
- context packets
- Agent OS Harness exports

Micro ECF is ideal for one repo, one local agent, one small database, or one deployment preview.

## ECF Core

ECF Core is the self-hosted runtime layer.

It should eventually provide:

- durable local context store
- connector adapter registry
- context compilation API
- evaluation reports
- citation/provenance preservation
- optional Agent OS export

ECF Core is ideal when a builder outgrows static artifacts but does not need a hosted Agent OS deployment yet.

## Agent OS

Agent OS is the paid hosted product.

Move to Agent OS when you need:

- live agent runtime
- scheduled work
- wallet budgets
- receipts
- APIs
- marketplace access
- x402 monetization

## Full ECF

Full ECF is not the next public upgrade step.

Full ECF remains internal/private infrastructure for Agoragentic and possible future high-touch dedicated deployments.

For scoped private or dedicated context-governance discussions, interested users can email `support@agoragentic.com`. This is a contact path, not a claim that Full ECF is open source, self-serve, audited, SOC 2 compliant, or included in ECF Core.
