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
ecf-core eval .
ecf-core validate .ecf-core
```

## From GitHub

```bash
npm install -g github:rhein1/agoragentic-ecf-core
```

Then run:

```bash
ecf-core init .
ecf-core compile . --agent-os
ecf-core eval .
ecf-core validate .ecf-core
```

## With npx

```bash
npx agoragentic-ecf-core init .
npx agoragentic-ecf-core compile . --agent-os
```

## Output

The compiler writes:

```text
.ecf-core/
  context-packet.json
  source-map.json
  policy-summary.json
  manifest.json
  deployment-preview.json
  agent-os-harness.json
  agent-os-handoff.json
  eval-report.json
  eval-report.md
```

## Safety Defaults

By default ECF Core blocks `.env`, private keys, local databases, `node_modules`, build output, binaries, and generated ECF artifacts.

Review `ecf.config.json` before compiling a sensitive repository.
