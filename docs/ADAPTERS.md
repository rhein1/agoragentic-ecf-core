# ECF Core Adapter Contracts

ECF Core adapters bring local or self-hosted context into the compiler.

The public contract is intentionally small:

```js
class ContextAdapter {
  canHandle(input) {}
  async discover(input) {}
}
```

Adapters return source records with:

- `id`
- `path`
- `type`
- `hash`
- `classification`
- `reason`
- `summary`
- `provenance`

## Included Adapter

`FilesystemAdapter` walks a local project, applies allow/block policy, reads safe text files, and emits citation-ready records.

It does not read blocked files into context. Blocked source hashes are metadata hashes so secrets are not copied into ECF artifacts.

## Included Summary Adapters

- `MarkdownDocsAdapter` extracts heading-level sections from allowed Markdown files.
- `SqliteSummaryAdapter` summarizes allowed SQLite schema exports such as `.sql` files; it does not read live `.sqlite` database files.
- `OpenApiAdapter` summarizes allowed OpenAPI/Swagger JSON or YAML files.
- `McpContextProviderAdapter` summarizes allowed MCP descriptor JSON files.

## Future Adapters

Good future public adapters:

- local code graph adapter
- optional local vector adapter
- optional Qdrant/Chroma adapter wrappers
- optional GitNexus/code-graph adapter

These should remain opt-in and dependency-free by default. ECF Core should still install and run without embeddings, vector databases, remote LLMs, hosted connectors, or model-backed rerankers.

The ranking layer now exposes these providers as bounded eval contracts: `local_vector` runs entirely in-process, while `qdrant`, `chroma`, `gitnexus_code_graph`, and `mcp_context_provider` require caller-supplied precomputed results or fall back to semantic-lite scoring with a skipped status. No external service is contacted by default.

## Custom Adapters

See [Custom Adapters](CUSTOM_ADAPTERS.md) for the extension contract and a minimal example.

Adapters that belong outside this repo:

- private customer connectors
- hosted Agent OS provisioning
- wallet/x402 settlement
- marketplace ranking
- SOC 2 evidence automation
