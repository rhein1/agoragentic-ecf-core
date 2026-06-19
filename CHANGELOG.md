# Changelog

All notable changes to ECF Core are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project follows semantic versioning for public CLI/schema surfaces.

## [1.5.0] - 2026-06-18

### Added
- `source-manifest.json` for included, blocked, review-required, and generated-excluded source facts without copying blocked raw content.
- `code-index.json` for dependency-free symbols, imports, and entrypoint hints from indexed code files.
- `context-router.json` plus MCP `ecf_core.route_query` for routing questions to exact evidence, policy lookup, code-symbol lookup, source-manifest facts, deterministic stats, or semantic summary fallback.
- Schema contracts and deterministic regression coverage for source-manifest, code-index, and context-router artifacts.
- Context-router documentation with an optional future Gortex adapter path that does not add a required dependency.

### Changed
- Agent OS preview/import artifacts now include the new manifest, code-index, and router evidence files.
- Eval reports now include source-manifest, code-index, and context-router readiness metrics while staying scoped to local packet readiness.

## [1.4.4] - 2026-06-14

### Changed
- Updated the npm README launch path so ECF Core's local MCP quickstart, copy/paste install flow, and no-hosted-runtime boundary are visible from the package page.

## [1.4.3] - 2026-06-12

### Fixed
- Agent OS preview command now always uses the inspected artifact directory path instead of comparing against the caller's working directory, preventing wrong-path references when running `ecf-core agent-os-preview` against external artifact directories.

## [1.4.2] - 2026-06-12

### Added
- Public LLM discovery surfaces: `SKILL.md`, `llms.txt`, and `llms-full.txt`.
- Citation metadata in `CITATION.cff`.
- Documentation index in `docs/README.md`.
- Glama registry metadata for the local MCP server.
- CODEOWNERS for repository review routing.
- Tokenless npm Trusted Publishing workflow and setup notes for `agoragentic-ecf-core`.
- First-run adoption regression coverage for policy text fidelity, default code indexing, secret blocking, MCP retrieval, Agent OS preview next steps, and README first-screen usability.
- Claude Code and Cursor MCP configuration snippets.

### Changed
- Clarified the boundary between Micro ECF, ECF Core, Triptych OS (Agent OS), and private Full ECF.
- Added discovery files to the npm package file list.
- Preserved meaningful source body text in summaries, evidence units, context indexes, and MCP search results.
- Included common root-level code files in the default source policy.
- Removed the colliding `micro-ecf` binary alias from the ECF Core package.
- Scoped `eval` wording to packet readiness rather than live deployment approval.
- Replaced the placeholder Agent OS preview next step with the actual `agoragentic-os preview` command and start URL.
- Hardened the OpenAPI adapter by avoiding regex-based filename and YAML detection in the scanner.

## [1.4.1] - 2026-05-18

### Added
- Page/tree context index artifacts.
- Retrieval-plan metadata for Agent OS preview readiness.
- Evidence-unit compatibility output.
- .NET source-preview lane for local C#, ASP.NET Core, and EF Core artifact compatibility.

## [1.0.0] - 2026-04-29

### Added
- Initial public ECF Core CLI, schemas, local compiler, deterministic evals, and Agent OS preview artifacts.
