# ECF Core architecture

ECF Core is a local-first compiler and context-serving layer. It does not execute an agent's business task, deploy a hosted runtime, or settle payments.

## Data flow

```text
bounded project sources
├── files and Markdown
├── code and symbols
├── policy files
├── safe database summaries
├── OpenAPI summaries
└── declared context providers
        ↓
source inventory and policy evaluation
        ↓
source-map.json
source-manifest.json
policy-summary.json
        ↓
indexes and evidence
        ↓
code-index.json
page-index.json / tree-index.json
retrieval-plan.json
evidence-units.json
        ↓
context-router.json
        ↓
local evaluation and serving
        ↓
grounding-eval.json
local MCP tools
resident work context
optional agent-os-import.json
```

## Trust boundary

The compiler operates on bounded local inputs. Blocked sources are represented as policy facts without serving their raw content.

Examples of default blocked classes include secret files, private keys, local databases, dependency folders, generated output, and ECF's own generated artifact folders. The exact project policy remains authoritative.

## Main modules

| Layer | Responsibility |
|---|---|
| Configuration and policy | Resolve project rules, allowed inputs, blocked paths, and export constraints. |
| Adapters | Convert supported source classes into bounded descriptors and evidence. |
| Compiler | Produce deterministic context, policy, source, and Agent OS artifacts. |
| Context indexes | Preserve page/tree relationships, code symbols, imports, and retrieval plans. |
| Context router | Route a question to exact evidence, policy lookup, code-symbol lookup, deterministic facts, or semantic-lite ranking. |
| Evidence units | Represent source-backed claims with provenance and policy state. |
| Evaluation | Check artifact validity, evidence preservation, grounding, and compaction behavior. |
| Resident context | Maintain inspectable local worklog, handoff, and next-session artifacts. |
| MCP server | Expose compiled local context to an MCP-compatible host. |
| Agent OS export | Prepare an owner-reviewable preview/import packet without deploying anything. |

## Optional provider contracts

ECF Core can accept bounded results from optional context providers. The public contracts include built-in semantic-lite ranking and precomputed-result hooks for vector stores, code graphs, and MCP context providers.

Provider declarations do not grant a provider access to blocked source material. The caller remains responsible for configuring the external provider and its data boundary.

## Separation from other Agoragentic layers

```text
Micro ECF
→ smallest persistent project contract and local artifact workflow

ECF Core
→ richer self-hosted compilation, routing, evidence, evaluation, and MCP

Harness Core
→ tool/action lifecycle governance, approvals, evidence, and local receipts

Triptych OS
→ hosted governed runtime and operational control plane

Router / Marketplace and Interchange
→ capability transactions and cross-market reconciliation
```

## Security properties

ECF Core is designed to fail closed when required source or policy evidence is missing. Its generated artifacts are evidence inputs, not a claim that an agent action is safe, correct, certified, or authorized.

See:

- [Boundary](BOUNDARY.md)
- [Adapter contracts](ADAPTERS.md)
- [Context router](CONTEXT_ROUTER.md)
- [Evidence units](EVIDENCE_UNITS.md)
- [Evaluation](EVALUATION.md)
- [Local MCP](MCP_SERVER.md)
- [Agent OS import](AGENT_OS_IMPORT.md)
