# ECF Core Roadmap

## Phase 0: Public Boundary

- [x] README
- [x] license
- [x] contribution rules
- [x] boundary documentation
- [x] schema stubs
- [x] local example

## Phase 1: Schemas

- [x] context packet schema
- [x] source map schema
- [x] policy summary schema
- [x] connector adapter schema
- [x] Agent OS handoff schema
- [x] local config schema

## Phase 2: Local Compiler

- [x] local document loader
- [x] source hashing
- [x] source summaries
- [x] citation metadata
- [x] policy filtering
- [x] deterministic source IDs
- [x] context packet output
- [x] semantic-lite ranking beyond exact lexical eval scoring

## Phase 3: Adapter Contracts

- [x] filesystem adapter
- [x] markdown/docs adapter
- [x] SQLite summary adapter
- [x] OpenAPI/API-doc adapter
- [x] generic MCP context-provider adapter

## Phase 4: Evaluation

- [x] retrieval preservation fixture
- [x] citation survival fixture
- [x] policy-block fixture
- [x] compression experiment fixture
- [x] JSON and Markdown reports
- [x] local grounding eval loop

## Phase 5: Agent OS Handoff

- [x] basic Agent OS handoff export
- [x] deployment-preview export
- [x] Agent OS Harness export
- [x] no-spend readiness check integration
- [x] Agent OS preview-import readiness check
- [x] optional grounding evidence for preview imports

## Phase 6: Stable OSS Release

- [x] npm publication
- [x] stable schema/versioning policy
- [x] Agent OS import contract
- [x] adapter extension example
- [x] broader fixture coverage
- [x] compression experiment fixture

## Phase 7: Next OSS Tranche

- [ ] optional local MCP server for active context serving
- [ ] richer semantic ranking adapters that remain optional and dependency-free by default
- [ ] schema examples for third-party Agent OS importers
- [ ] signed release provenance from GitHub Actions

## Explicit Non-Goals

- enterprise tenant isolation
- SOC 2 evidence program
- private copilot runtime
- customer-specific connector catalog
- hosted runtime provisioning
- wallet or x402 settlement
- marketplace ranking
