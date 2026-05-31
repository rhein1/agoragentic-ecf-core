# Install ECF Core

ECF Core is an open-source local/self-hosted context governance package.

It does not deploy agents, handle wallets, route marketplace calls, or include Full ECF private internals.

## From npm

```bash
npm install -g agoragentic-ecf-core
```

Then run:

```bash
ecf-core init .
ecf-core compile . --agent-os
ecf-core eval . --grounding
ecf-core agent-os-preview .ecf-core
ecf-core validate .ecf-core
```

Optional active context serving for IDEs and local MCP clients:

```bash
ecf-core serve-mcp .ecf-core
```

The MCP server reads local compiled artifacts only. It does not deploy agents, spend funds, call remote models, or call Agoragentic Cloud.

Optional resident work memory for session continuity:

```bash
ecf-core worklog begin . --goal "current goal"
ecf-core worklog checkpoint . --summary "what changed" --validation "npm test"
ecf-core docs-sync plan .
ecf-core handoff . --write
```

These commands write local `.ecf-core/` worklog, docs-sync, handoff, and next-session files. They do not auto-edit docs, deploy agents, spend funds, call x402, or expose private Full ECF internals.

## From GitHub

```bash
npm install -g github:rhein1/agoragentic-ecf-core
```

Then run:

```bash
ecf-core init .
ecf-core compile . --agent-os
ecf-core eval . --grounding
ecf-core agent-os-preview .ecf-core
ecf-core validate .ecf-core
```

## With npx

```bash
npx agoragentic-ecf-core init .
npx agoragentic-ecf-core compile . --agent-os
```

## Output

The compile/eval flow writes:

```text
.ecf-core/
  context-packet.json
  source-map.json
  policy-summary.json
  manifest.json
  deployment-preview.json
  agent-os-harness.json
  agent-os-handoff.json
  agent-os-import.json
  eval-report.json
  eval-report.md
  grounding-eval.json
  grounding-eval.md
  worklog/current.json
  worklog/latest-summary.md
  docs-sync-plan.json
  handoff.md
  next-session.md
```

## Safety Defaults

By default ECF Core blocks `.env`, private keys, local databases, `node_modules`, build output, binaries, and generated ECF artifacts.

Review `ecf.config.json` before compiling a sensitive repository.

For IDE assistants or LLM chats, start with the durable handoff in [`../ECF.md`](../ECF.md).
