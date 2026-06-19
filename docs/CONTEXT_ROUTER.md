# Source Manifest, Code Index, And Context Router

ECF Core compiles local context into routed artifacts instead of treating larger context windows as the retrieval strategy.

## Generated Artifacts

```text
.ecf-core/source-manifest.json
.ecf-core/code-index.json
.ecf-core/context-router.json
```

`source-manifest.json` records every discovered non-generated source as included, blocked, or review-required. It records hashes, byte counts, line counts, reasons, and provenance without copying blocked raw content.

`code-index.json` records dependency-free code facts from indexed code files: symbols, imports, and entrypoint hints. It is intentionally simple and local. It is not a complete compiler, language server, or hosted code graph.

`context-router.json` declares the local route order:

1. `exact_text_lookup`
2. `policy_lookup`
3. `code_symbol_lookup`
4. `source_manifest_query`
5. `deterministic_stats`
6. `semantic_summary`

This keeps exact evidence, policy boundaries, source stats, and code-symbol questions out of generic prose retrieval when a deterministic artifact can answer them.

## MCP Usage

```json
{
  "query": "Where does it say customer PII cannot leave the repo?",
  "top_k": 5
}
```

Call:

```text
ecf_core.route_query
```

The response includes the selected route, local artifact summary, results or deterministic stats, and the same no-deploy/no-wallet/no-Full-ECF boundary used by the rest of ECF Core.

## Optional Code-Graph Providers

External local-first code graph tools such as Gortex can be evaluated as optional source-index providers. The safe adapter shape is:

```text
external code graph output
-> reviewed local adapter
-> code-index.json enrichment
-> context-router.json route metadata
```

Do not make an external graph engine mandatory for the first-run ECF Core artifact. The baseline compiler must still preserve source text, block secrets, index common code files, and answer MCP questions with provenance using only built-in local code.
