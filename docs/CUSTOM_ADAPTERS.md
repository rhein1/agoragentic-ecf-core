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

It returns source records shaped like `ecf-core.connector-adapter.v1`.

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

See [`examples/custom-adapter/custom-keyword-adapter.js`](../examples/custom-adapter/custom-keyword-adapter.js).
