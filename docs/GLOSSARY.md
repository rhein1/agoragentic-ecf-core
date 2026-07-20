# ECF Core Glossary

## Adapter

A local compiler extension with deterministic `canHandle()` and `discover()` behavior. It returns source records with classification, reason, summary, hash, and provenance. See [Custom Adapters](./CUSTOM_ADAPTERS.md).

## Agent OS import

A compiled preview/handoff artifact that Triptych OS (Agent OS) can inspect in a later owner-reviewed flow. It is not hosted provisioning, wallet funding, public marketplace exposure, or settlement.

## Allowed, blocked, and review-required

The three source-policy classifications. Allowed records may contribute bounded context; blocked records remain unavailable; review-required records need explicit review before promotion. Classification evidence does not itself grant action authority.

## Code index

`.ecf-core/code-index.json`, a dependency-free index of detected symbols, imports, and entrypoint hints for indexed code files.

## Context Evidence Unit

A citation-backed claim plus policy and provenance metadata. `evidence-units.json` is the current Agent OS-facing compile artifact; `context-evidence-units.json` remains a compatibility alias.

## Context packet

A bounded compiled collection of approved summaries and citations for local agent use. It is not proof that a hosted model or runtime used those sources.

## Context router

`.ecf-core/context-router.json`, the deterministic route order for exact text, policy, code-symbol, source-manifest, statistics, and semantic-summary lookups. It avoids treating a larger prompt as the retrieval strategy.

## ECF Compile Stage

The local pipeline that turns governed sources into source maps, manifests, policy summaries, evidence units, indexes, evaluation reports, and optional Agent OS preview/import artifacts.

## Evaluation verdict

The deterministic packet-readiness result written by `ecf-core eval`. `pass` means the checked contract met its thresholds; `review` means the evaluation completed but its report contains gaps that require inspection. A completed command is not equivalent to a `pass` verdict.

## Full ECF

Private Agoragentic enterprise runtime infrastructure. It is not included in ECF Core and must not be inferred from public schemas, adapters, examples, or artifacts.

## Grounding evaluation

A local fail-closed loop that retrieves allowed sources, creates an extractive answer, checks citation support, retries a bounded rewrite, and returns an explicit unsupported answer when evidence is insufficient.

## Local/self-hosted

The operator runs the compiler, owns the source boundary, and stores `.ecf-core` artifacts. This does not mean the full Agoragentic control plane, wallets, marketplace, or settlement are self-hosted.

## Policy summary

A compact compiled representation of source classifications, action boundaries, and relevant policy settings for review and handoff.

## Preview readiness

The result of checking required Agent OS import artifacts, schemas, acceptance evidence, and public boundary flags. Ready means the handoff can proceed to a separate preview step; it does not authorize deployment, billing, funding, or public exposure.

## Provenance

Evidence of a record's adapter, source kind, path, hash, and parent relationship where applicable. Provenance supports auditability; it does not establish remote availability or truth beyond the compiled source.

## Resident work memory

Local worklog, status, context-pack, docs-sync, and handoff artifacts used to continue an IDE session. They do not auto-edit documentation, commit code, deploy agents, or grant financial authority.

## Source manifest

`.ecf-core/source-manifest.json`, the inventory of included, blocked, review-required, and generated-excluded source facts. It records boundary evidence without copying blocked raw content.

## Triptych OS (Agent OS)

Agoragentic's hosted runtime/control-plane product. ECF Core may prepare preview/import evidence for it, but does not provide its runtime, budgets, wallets, receipts, marketplace access, x402, or reconciliation services.
