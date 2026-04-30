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

Adapters that belong outside this repo:

- private customer connectors
- hosted Agent OS provisioning
- wallet/x402 settlement
- marketplace ranking
- SOC 2 evidence automation
