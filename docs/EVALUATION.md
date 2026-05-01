# Evaluation

`ecf-core eval` compiles local artifacts, runs deterministic checks, and writes:

```text
.ecf-core/eval-report.json
.ecf-core/eval-report.md
```

## Metrics

The report includes:

- policy block pass/fail
- citation survival
- structural provenance preservation
- retrieval preservation with semantic-lite scoring
- compression experiment metrics
- optional grounding eval loop

## Semantic-Lite Ranking

Semantic-lite ranking is dependency-free. It expands a small built-in synonym map for common local-agent concepts such as API/OpenAPI, database/SQLite, policy/governance, and deployment/handoff.

It is not an embedding model and does not call a remote service.

## Compression Experiment

The compression experiment is a deterministic baseline. It compacts source summaries while preserving:

- source ID
- path
- type
- hash
- citation label
- provenance

The goal is to show whether smaller local context records can preserve retrieval order, citationability, and provenance. It is not CLaRa, not an ML dependency, and not a live compression-backed retriever.

## Grounding Eval Loop

Run:

```bash
ecf-core eval . --grounding
```

The grounding loop is deterministic and local:

```text
test question
-> retrieve from allowed context packet sources
-> synthesize an extractive answer
-> grade citation support
-> rewrite and retry when unsupported
-> fail closed with the configured unsupported response
```

It writes:

```text
.ecf-core/grounding-eval.json
.ecf-core/grounding-eval.md
```

Unsupported answers default to:

```text
I don't know based on the allowed context.
```

This is local evaluation evidence only. It does not deploy agents, call a paid LLM, authorize wallet actions, route marketplace work, or include Full ECF private internals. Agent OS can import the grounding evidence during preview, but live deployment remains a separate owner-reviewed flow.
