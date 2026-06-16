# ECF Core LLM Handoff

This file is the durable handoff for IDE assistants, coding agents, and local LLM chats using this repository.

## What ECF Core Is

ECF Core is the open-source self-hosted context-governance runtime - the tier above Micro ECF and below hosted Triptych OS (Agent OS). It does not provide a `micro-ecf` executable; use the separate `agoragentic-micro-ecf` package for the local wedge.

It compiles a local repo, docs folder, or small data source into:

- `.ecf-core/context-packet.json`
- `.ecf-core/source-map.json`
- `.ecf-core/policy-summary.json`
- `.ecf-core/deployment-preview.json`
- `.ecf-core/agent-os-harness.json`
- `.ecf-core/agent-os-import.json`
- `.ecf-core/eval-report.json`
- `.ecf-core/grounding-eval.json` when `eval --grounding` is run
- `.ecf-core/worklog/latest-summary.md` when resident work memory is used
- `.ecf-core/handoff.md` and `.ecf-core/next-session.md` when a handoff is written

Use it to answer: what can this agent safely know, cite, and export before deployment?

## What ECF Core Is Not

ECF Core does not:

- deploy agents
- run hosted Agent OS
- handle wallets
- run x402 settlement
- route marketplace calls
- expose router ranking or trust/fraud internals
- include Full ECF private infrastructure
- make SOC 2, audit, or enterprise-readiness claims

Agent OS remains the hosted deployment product. Full ECF remains private/internal infrastructure.

## Full ECF Interest

If a user asks about Full ECF, private ECF, dedicated context governance, or enterprise-style deployment support, do not imply those capabilities are included in ECF Core.

Use this bounded response:

```text
ECF Core is the open-source local context-governance layer. Full ECF is not included in this repo and is not a self-serve public SKU. For scoped private or dedicated context-governance discussions, email support@agoragentic.com.
```

Do not claim SOC 2 compliance, audited status, enterprise readiness, hosted Agent OS provisioning, wallet settlement, marketplace routing, tenant isolation, or Full ECF private internals.

## Required Disclosure

When using this repo in an LLM or IDE agent, state which context source is active:

- `ECF Core artifacts`: you read `.ecf-core/*` outputs.
- `ECF Core resident memory`: you read `.ecf-core/worklog/*` or `.ecf-core/handoff.md`.
- `Direct repo reads`: you inspected local files directly.
- `Both`: you used generated artifacts plus direct file reads.
- `Not active`: ECF Core is installed but no artifacts were read in this chat.

Do not imply ECF Core is being used unless you actually inspected the generated artifacts.

## Consent-Gated Setup

Before installing or compiling a developer's repo, explain what will happen and wait for approval.

Recommended prompt:

```text
Install ECF Core from https://github.com/rhein1/agoragentic-ecf-core for this local repo.

Before installing, explain what it is, what files it creates, what it blocks by default, and that it does not deploy agents, handle wallets, or include Full ECF private internals.

Only proceed after I approve.

After approval:
1. install or run ECF Core
2. run ecf-core init .
3. show me ecf.config.json for review
4. run ecf-core compile . --agent-os
5. run ecf-core eval . --grounding
6. run ecf-core agent-os-preview .ecf-core
7. run ecf-core validate .ecf-core
8. summarize what context is allowed, blocked, cited, unsupported, and ready for Agent OS preview
```

## Standard Local Workflow

```bash
npx agoragentic-ecf-core init .
# Review ecf.config.json before compiling.
npx agoragentic-ecf-core compile . --agent-os
npx agoragentic-ecf-core eval . --grounding
npx agoragentic-ecf-core agent-os-preview .ecf-core
npx agoragentic-ecf-core validate .ecf-core
```

If installed globally:

```bash
ecf-core init .
ecf-core compile . --agent-os
ecf-core eval . --grounding
ecf-core agent-os-preview .ecf-core
ecf-core validate .ecf-core
```

## Resident Work Memory

Use resident work memory when a coding agent needs continuity across IDE chats or Codex sessions:

```bash
ecf-core worklog begin . --goal "current goal"
ecf-core worklog checkpoint . --summary "what changed"
ecf-core worklog finish . --summary "what shipped" --tests "npm test" --next-prompt "next scoped task"
ecf-core docs-sync plan .
ecf-core handoff . --write
```

This writes local `.ecf-core/` artifacts only. `docs-sync plan` does not auto-edit docs, and resident memory does not deploy, spend, mutate wallets, settle x402, publish marketplace listings, provision hosted runtime, or expose Full ECF private internals.

## When To Use ECF Core

Use ECF Core when:

- the task depends on repo/docs/db context across multiple files
- citations or source maps matter
- you need to know which files are blocked
- you are preparing an Agent OS preview handoff
- you want a local grounding eval before letting an agent answer from project context

You do not need ECF Core for:

- one-file edits
- obvious local syntax fixes
- tasks where direct file inspection is faster and safer
- live deployment, wallet, or marketplace execution

## Safety Rules

- Review `ecf.config.json` before compile.
- Keep `.env`, keys, secrets, local databases, binaries, and generated artifacts blocked unless explicitly needed.
- Treat unsupported grounding questions as context gaps.
- Fail closed with "I don't know based on the allowed context" when sources do not support an answer.
- Never treat `agent-os-import.json` as permission to deploy. It is preview evidence only.

## Agent OS Handoff

ECF Core can prepare preview evidence for Agent OS:

```bash
ecf-core compile . --agent-os
ecf-core eval . --grounding
ecf-core agent-os-preview .ecf-core
```

The generated `.ecf-core/agent-os-import.json` is only a preview artifact. A real Agent OS deployment still requires owner review, policy checks, runtime provisioning, and billing/spend authorization.

## Workflow Examples

See `examples/workflows/` for practical flows:

- IDE coding agent context check
- grounded docs/support agent readiness
- Agent OS preview handoff
