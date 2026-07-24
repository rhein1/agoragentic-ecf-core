# Contributing

ECF Core contributions should improve local and self-hosted context governance without pulling private platform internals into the public repo.

Good contributions:

- schema improvements
- local examples
- deterministic tests
- adapter contracts
- documentation clarity
- policy and provenance modeling

Do not contribute:

- customer data
- secrets
- private connector code
- hosted Agent OS internals
- Full ECF enterprise runtime internals
- settlement, trust-ranking, or fraud-scoring logic
- SOC 2 or audit claims

By contributing, you agree that public ECF Core stays bounded to open local/self-hosted context governance.

## Contribution Workflow

1. Use Node.js 20 or later and choose one bounded change: schema, adapter, local example, deterministic compiler/evaluation behavior, or documentation.
2. Read the relevant source, schema, tests, and public boundary docs before editing.
3. Use local fixtures and temporary directories. Never add customer data, secrets, wallet material, hosted credentials, or private connectors.
4. Add or update deterministic tests for behavior changes. Default validation must not require network access, a paid model, a hosted vector database, or Agent OS credentials.
5. Update the README, [CLI reference](./docs/CLI_REFERENCE.md), [glossary](./docs/GLOSSARY.md), or [troubleshooting guide](./docs/TROUBLESHOOTING.md) when a public contract changes.

For an adapter contribution:

1. Follow the [custom adapter contract](./docs/CUSTOM_ADAPTERS.md) and validate each returned record against the record definition in [`connector-adapter.schema.json`](./schemas/connector-adapter.schema.json).
2. Implement deterministic `canHandle()` and `discover()` behavior with explicit provenance and classification.
3. Start from the [custom adapter example](./examples/custom-adapter/README.md), add a focused compiler test, and prove blocked or review-required inputs are not promoted to allowed context.
4. Document required dependencies, local configuration, failure behavior, and unsupported source types.

Before opening a pull request, run:

```bash
npm run docs:check
npm test
npm run check
npm run pack:dry
```

Include the exact commands and results in the pull request. Explain changed files and schemas, artifact-shape changes, boundary assumptions, and intentionally unsupported behavior. Performance claims must name the fixture, machine/runtime, command, sample size, and measured result; do not turn one local measurement into a general benchmark claim.

A contribution is ready when focused and full tests pass, the package contains the intended public files, and the docs make no hosted-runtime, wallet, x402 settlement, marketplace, enterprise-audit, or private Full ECF claim.
