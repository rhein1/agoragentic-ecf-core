# Custom Adapter Example

This example shows the smallest adapter shape ECF Core accepts.

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
