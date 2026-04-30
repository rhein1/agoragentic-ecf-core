# AGENTS.md

This repository is the public ECF Core repository.

## Canonical Product Rule

Micro ECF is the local context wedge.
ECF Core is the open-source self-hosted context governance runtime.
Agent OS is the hosted deployment product.
Full ECF is internal/private platform infrastructure and future high-touch dedicated deployment infrastructure.

Do not describe ECF Core as:

- SOC 2 compliant
- audited
- enterprise-ready
- Full ECF
- Agent OS Enterprise
- hosted runtime
- wallet settlement
- marketplace routing

## Edit Rules

- Keep public copy honest and bounded.
- Do not add secrets, local databases, customer data, private connector code, or platform internals.
- Prefer schemas, examples, adapter contracts, deterministic tests, and local-only workflows.
- If a feature requires tenant isolation, enterprise audit storage, private copilot runtime, or customer evidence tooling, it belongs outside this public repo.

## Safe Work

- schemas
- docs
- local examples
- context compiler contracts
- connector adapter interfaces
- deterministic eval fixtures
- local CLI scaffolding

## Unsafe Work

- production customer data
- private Full ECF internals
- hosted Agent OS provisioning
- router ranking
- trust/fraud scoring
- wallet/x402 settlement
- private connectors
- operator prompts
- SOC 2 or audit claims
