# Real-World Example Fixtures

These fixtures are small, safe examples that exercise ECF Core against realistic local project shapes.

## Fixtures

- `docs-knowledge-base`: documentation, support, and security policy context.
- `api-service`: OpenAPI-driven service context and Agent OS preview handoff.
- `sqlite-app`: schema-summary context without reading raw SQLite data.

## Run

```bash
ecf-core eval examples/real-world/docs-knowledge-base --json
ecf-core eval examples/real-world/api-service --json
ecf-core eval examples/real-world/sqlite-app --json
```

Each eval writes `.ecf-core/` artifacts inside the fixture directory. The test suite removes generated artifacts after validation.
