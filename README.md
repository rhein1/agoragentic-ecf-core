# ECF Core

ECF Core is the open-source context governance runtime for local and self-hosted AI systems.

It is designed for builders who want more structure than a one-off RAG script, but do not need an enterprise sales motion, SOC 2 review package, managed tenant operations, or Agoragentic-hosted deployment.

ECF Core helps answer:

- What context is allowed?
- Where did it come from?
- What must be blocked?
- What can be cited?
- What can be handed to an agent safely?
- What should be exported into Agent OS later?

## Product Boundary

ECF Core is not Full ECF Enterprise.

```text
Micro ECF
-> local context and policy packets for builders

ECF Core
-> open-source self-hosted context governance runtime

Agent OS
-> paid hosted deployment, runtime, budgets, APIs, receipts, marketplace access, and x402

Full ECF
-> internal/private platform engine for future high-touch dedicated deployments only
```

## What Is Included

- Context packet schema
- Policy summary schema
- Source map schema
- Provenance and citation contract
- Local/self-hosted runtime boundary
- Connector adapter contracts
- Evaluation and evidence roadmap
- Safe examples for local projects

## What Is Not Included

ECF Core does not include:

- Full ECF enterprise tenant-isolation internals
- Enterprise access-audit storage internals
- Customer evidence-packet automation
- Private copilot runtime
- Private connector implementations
- Hosted Agent OS provisioning
- Router ranking
- Trust/fraud scoring
- Wallet settlement
- x402 settlement execution
- Operator prompts or internal runbooks
- SOC 2 certification or audit claims

## Relationship To Micro ECF

Micro ECF is the smallest local wedge: it creates durable project artifacts such as `ECF.md`, source maps, policy summaries, and Agent OS Harness exports.

ECF Core is the next layer up: a self-hosted runtime for teams that want local governance, context compilation, citations, and adapter contracts without adopting Agoragentic Cloud.

## Relationship To Agent OS

Agent OS is where agents become deployed products.

Use Agent OS when you need:

- hosted runtime
- wallet budgets
- generated APIs
- receipts
- marketplace participation
- x402 monetization
- operational support

ECF Core can prepare context and policy evidence for Agent OS, but it does not deploy agents or handle money.

## Current Status

This repository is the public boundary scaffold for ECF Core.

The first release should stay intentionally small:

1. schemas
2. local examples
3. adapter contracts
4. basic context compiler
5. deterministic eval harness

Do not copy the private `agoragentic-enterprise/` runtime into this repo.

## Install

No package is published yet.

For now, use this repository as the public specification and contribution target for ECF Core.

## License

Apache-2.0.
