# ECF Core for .NET

ECF Core for .NET is a source-preview lane for C#, ASP.NET Core, EF Core, and Microsoft-stack agent projects.

It is not a rewrite of Full ECF and it is not hosted Agent OS. The .NET lane produces and consumes the same ECF Core artifacts used by the Node CLI so .NET builders can prepare local context evidence for Agent OS preview.

## What It Does

- Reads and validates existing `.ecf-core/` artifacts.
- Scans local `.sln`, `.csproj`, `.cs`, ASP.NET routes, EF Core context hints, and appsettings files.
- Blocks common .NET build outputs and sensitive files by default.
- Redacts common secret/config keys before export.
- Emits preview-only Agent OS artifacts.

## What It Does Not Do

- It does not deploy agents.
- It does not provision hosted runtime.
- It does not handle wallets or settlement.
- It does not run x402 execution.
- It does not route marketplace calls.
- It does not include Full ECF private internals.
- It does not claim SOC 2, audit, or enterprise-readiness status.

## Planned Install Shape

After NuGet publication:

```bash
dotnet tool install --global Agoragentic.EcfCore.Cli
```

Then:

```bash
ecfnet init
ecfnet compile --agent-os
ecfnet eval --grounding
ecfnet validate
```

## Artifact Compatibility

The .NET lane writes the same artifact names:

```text
.ecf-core/
  context-packet.json
  source-map.json
  policy-summary.json
  manifest.json
  deployment-preview.json
  agent-os-handoff.json
  agent-os-harness.json
  agent-os-import.json
  eval-report.json
  eval-report.md
  grounding-eval.json
  grounding-eval.md
```

Agent OS imports remain preview-only until a separate owner-reviewed Agent OS launch flow approves runtime provisioning, policy checks, and billing/spend authorization.

## Default .NET Safety Policy

Blocked by default:

```text
bin/**
obj/**
.vs/**
TestResults/**
*.pfx
*.snk
*.user
*.suo
*.nupkg
*.dll
*.exe
*.pdb
*.db
*.sqlite
*.bak
*.publishsettings
Properties/ServiceDependencies/**
```

Redacted key patterns:

```text
ConnectionStrings
Password
Secret
ClientSecret
ApiKey
Token
PrivateKey
Certificate
InstrumentationKey
ApplicationInsights
AzureWebJobsStorage
ServiceBus
Cosmos
Redis
OpenAI
Anthropic
Groq
Stripe
Coinbase
```

Review required:

```text
appsettings.Production.json
appsettings.Staging.json
launchSettings.json
secrets.json
UserSecretsId references
database migration files
```
