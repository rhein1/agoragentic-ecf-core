# Custom Adapters

ECF Core adapters let you bring local/self-hosted context into the compiler without changing the core package.

## Contract

An adapter must expose:

```js
{
  name: 'my_adapter',
  capabilities: ['my_capability'],
  canHandle(input) {
    return true;
  },
  async discover(input) {
    return [];
  }
}
```

`discover(input)` receives:

- `projectRoot`
- `config`
- `fileInventory`
- `walkState`

It returns an array of source records shaped like the `$defs.record` definition in [`connector-adapter.schema.json`](../schemas/connector-adapter.schema.json). `AdapterRegistry.discoverAll()` flattens those arrays, and `compileProject()` consumes the records directly. Neither the adapter nor the compiler creates the schema's outer `ecf-core.connector-adapter.v1` envelope; that top-level shape is a standalone interchange and validation contract.

## Required Record Fields

- `id`
- `path`
- `type`
- `classification`: `allowed`, `blocked`, or `review_required`
- `reason`
- `hash`
- `summary`
- `provenance.adapter`
- `provenance.source_kind`

## Boundary

Public adapters should summarize context. They should not copy secrets, connect to private customer systems by default, deploy agents, route marketplace calls, or handle wallets/settlement.

See the [custom adapter example](../examples/custom-adapter/README.md) and its [`custom-keyword-adapter.js`](../examples/custom-adapter/custom-keyword-adapter.js) implementation.
