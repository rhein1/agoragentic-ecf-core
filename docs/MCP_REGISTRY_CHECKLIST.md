# ECF Core MCP Registry Checklist

ECF Core ships a local stdio MCP server for compiled `.ecf-core` artifacts. This checklist records the public-readiness gates before submitting or refreshing registry metadata.

## Completed Gates

- [x] MCP server starts from the published CLI with `ecf-core serve-mcp .ecf-core`.
- [x] README includes a first-screen MCP command.
- [x] README includes a copy-paste stdio client configuration for Claude Code / Cursor-style MCP clients.
- [x] README includes a retrieval example with source path, source id, citation, and policy status.
- [x] README includes a policy-boundary example showing blocked local sources such as `.env`.
- [x] Content-fidelity remediation landed before registry promotion: ECF Core emits `evidence-units.json` with source-backed citation evidence, and the Micro ECF markdown-summary fix landed in `rhein1/agoragentic-integrations#53`.
- [x] Public boundary remains local-only: no hosted Agent OS provisioning, wallet, x402 settlement, marketplace routing, remote model calls, or private Full ECF internals.

## Registry Metadata

- Package: `agoragentic-ecf-core`
- Command: `ecf-core`
- Transport: stdio
- Server args: `serve-mcp /absolute/path/to/project/.ecf-core`
- Primary docs: [`MCP_SERVER.md`](MCP_SERVER.md)
- Source repository: `https://github.com/rhein1/agoragentic-ecf-core`

## Smoke Command

```bash
npm install -g agoragentic-ecf-core
ecf-core init .
ecf-core compile . --agent-os
ecf-core eval . --grounding
ecf-core serve-mcp .ecf-core
```

The server reads compiled local artifacts only. It does not read blocked source text directly, deploy agents, spend funds, call hosted services, or expose private Full ECF internals.
