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
- context index metrics
- optional grounding eval loop

## Semantic-Lite Ranking

Semantic-lite ranking is dependency-free. It expands a small built-in synonym map for common local-agent concepts such as API/OpenAPI, database/SQLite, policy/governance, and deployment/handoff.

It is not an embedding model and does not call a remote service.

## Optional Ranking Providers

ECF Core stays dependency-free by default. The built-in ranking providers are:

- `semantic_lite` — default synonym-expanded lexical scoring.
- `lexical` — exact token overlap without synonym expansion.
- `local_vector` — deterministic local hashed-token vector scoring with no embedding model.

Optional external provider contracts are also supported for experiments:

- `qdrant`
- `chroma`
- `gitnexus_code_graph`
- `mcp_context_provider`

These external providers are not runtime dependencies. In the public package they only consume caller-supplied `precomputed_results` or fall back to built-in semantic-lite scoring with a `*_adapter_skipped` dependency status. They do not open network connections, start vector databases, call embedding APIs, or expose Full ECF internals.

Example:

```json
{
  "eval": {
    "queries": ["billing payment"],
    "ranking": {
      "provider": "local_vector",
      "dimensions": 64
    }
  }
}
```

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

ECF Core's grounding eval loop is the public, local version of a self-healing retrieval check. It is not trying to answer every possible question. It is testing whether the compiled local context can safely support an agent answer before that context is handed to Agent OS preview.

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

Expanded control flow:

```text
eval query
  |
  v
retrieve allowed sources from context-packet.json and tree-index.json when present
  |
  v
synthesize extractive answer
  |
  v
check support against citations
  |
  |-- grounded -> pass
  |
  |-- unsupported -> rewrite query -> retry
                                     |
                                     v
                         unsupported after retries
                                     |
                                     v
              "I don't know based on the allowed context."
```

Grounded questions include citation paths and matching tree node paths when `tree-index.json` is available.

It writes:

```text
.ecf-core/grounding-eval.json
.ecf-core/grounding-eval.md
```

Unsupported answers default to:

```text
I don't know based on the allowed context.
```

This is local evaluation evidence only. It does not deploy agents, call a paid LLM, authorize wallet actions, route marketplace work, start a vector database, or include Full ECF private internals. Agent OS can import `grounding-eval.json` during preview as evidence that local context is sufficient or insufficient, but live deployment remains a separate owner-reviewed flow.
