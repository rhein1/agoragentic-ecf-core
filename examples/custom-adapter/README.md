# Custom Adapter Example

This example shows the smallest copyable adapter shape ECF Core accepts. It uses only Node.js built-ins, so the adapter file does not depend on ECF Core's private source layout.

```js
const { compileProject } = require('agoragentic-ecf-core');
const { CustomKeywordAdapter } = require('./custom-keyword-adapter');

await compileProject({
  projectRoot: process.cwd(),
  emitAgentOs: true,
  adapters: [new CustomKeywordAdapter(['safe local context'])]
});
```

Adapters should summarize approved context and emit provenance. Do not use public adapters to copy secrets, deploy agents, route marketplace calls, or perform wallet/settlement actions.

`discover(input)` receives `projectRoot`, `config`, `fileInventory`, and `walkState`, and returns an array of records matching the `$defs.record` contract in [`connector-adapter.schema.json`](../../schemas/connector-adapter.schema.json). See [Custom Adapters](../../docs/CUSTOM_ADAPTERS.md) for the required fields and contribution checklist.
