# ECF Core Troubleshooting

Start with the local compile and validation sequence:

```bash
ecf-core compile . --agent-os
ecf-core eval . --grounding
ecf-core agent-os-preview .ecf-core
ecf-core validate .ecf-core
```

## `init` Says `ecf.config.json` Already Exists

ECF Core preserves an existing configuration. Review it and continue, or use `--force` only when you intentionally want the starter config to replace it:

```bash
ecf-core init . --force
```

## A Flag Says It Requires A Value

Value options such as `--config`, `--out`, `--task`, `--goal`, and `--summary` must be followed by a value. Remember that `--out` is relative to the selected project, while `--config` is resolved from the shell's current directory.

## Configuration JSON Will Not Load

Validate `ecf.config.json` as JSON and inspect the parser error. Do not work around an invalid or missing policy by broadening allowed sources. Generate a clean starter in a temporary directory if you need a comparison.

## A Source Is Allowed, Blocked, Or Review-Required Unexpectedly

Inspect the source manifest and policy summary. ECF Core applies explicit classification rules and keeps `review_required` separate from `allowed`; review-required content is not silently promoted. Check path patterns, adapter output, and provenance before changing policy.

## `validate` Fails

The JSON report distinguishes missing files, invalid JSON, schema-version mismatches, and malformed artifact shapes. Recompile with the intended project, config, and output directory, then validate that exact artifact directory. Do not treat the existence of `.ecf-core/` as proof that its files are current or valid.

## `agent-os-preview` Says Not Ready

Inspect its errors for missing import artifacts, schema mismatch, acceptance failure, or unsafe boundary flags. Re-run `compile --agent-os`, `eval --grounding`, and `validate`; then address the reported evidence. Preview readiness is still not deployment or funding authority.

## `status` Or `context-pack` Exits `1`

Resident status requires a project config and valid compiled artifacts. Recompile and validate the same `--out` directory. An `attention_required` resident state is a local evidence gap, not a hosted outage.

## `eval` Exits `0` But The Verdict Needs Review

The process exit code reports that evaluation completed, not that every readiness or grounding criterion passed. Inspect `eval-report.json`, `eval-report.md`, `grounding-eval.json`, and `grounding-eval.md` for verdicts, warnings, unsupported questions, and citations.

## Worklog Commands Reject The Request

`worklog begin` requires a goal. Checkpoint and finish operations require an active worklog and a summary. Use `ecf-core worklog status . --json` to inspect local state before continuing.

## MCP Tools Are Missing Or Queries Fail

Compile the project before starting `serve-mcp`, point it at the correct artifact directory, and reserve stdout for JSON-RPC. Query/source errors are returned as JSON-RPC tool errors rather than process exits. `mcp-config` currently supports the `codex` target; restart Codex after installing an entry. See [Local MCP Server](./MCP_SERVER.md).

## A Custom Adapter Does Not Contribute Records

Confirm `canHandle()` returns true, `discover()` returns an array, and every record includes the required classification, reason, hash, summary, and provenance fields. The runtime passes `projectRoot`, `config`, `fileInventory`, and `walkState`. Start from the [copyable custom adapter example](../examples/custom-adapter/README.md).

## Grounding Says The Answer Is Unsupported

That is the expected fail-closed result when allowed context cannot support the answer. Add an approved, cited source or refine the query; do not weaken blocked-source rules or present an uncited answer as grounded.
