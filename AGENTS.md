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

## Fable / ECF Workflow Discipline

- Use [docs/agent-workflow-contracts.md](docs/agent-workflow-contracts.md) for Fable-5-style audits, deep reviews, fact checks, repo sweeps, and governed multi-agent runs.
- Use [docs/fable-review-contract.md](docs/fable-review-contract.md) when writing PR-review findings.
- Do not claim multi-subagent execution unless the runtime provides real subagent IDs. If no subagent runtime is available, report `subagents: none_available`.
- Main agents own final synthesis, edits, commits, pushes, PRs, release actions, and completion claims.

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
