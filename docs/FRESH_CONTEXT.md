# Opt-in current-context compilation and retrieval

Status: implementation candidate. This is a local CLI path over the existing ECF compiler, not a replacement compiler, database, automatic refresh daemon, or production context service. Existing `ecf-core` commands and MCP retrieval are unchanged. They do not acquire freshness guarantees merely because this module exists.

## Commands

Run from this source checkout using Node 20 or newer:

```sh
node scripts/fresh-context.cjs compile /path/to/project
node scripts/fresh-context.cjs status /path/to/project
node scripts/fresh-context.cjs read /path/to/project
```

`compile` is an explicit local write. It invokes the canonical `compileProject` with the project's `ecf.config.json`, writes ordinary ECF artifacts into a new private generation under `.ecf-core/fresh/`, checks source/configuration/compiler identity before and after, hashes the output artifacts, and atomically selects the generation only after those checks pass.

`status` checks the selected generation without returning source content. `read` additionally returns its ordinary `ecf-core.context-packet.v1` only when the checks pass. Neither command refreshes or changes the selected generation. Stale or unavailable evidence returns `context:null`; non-fresh CLI results exit 2. Compilation failures exit 1.

For **content-hashed sources**, same-size edits are detected even when timestamps are restored. Source additions/deletions, changed configuration, changed canonical source metadata or changed JavaScript compiler source invalidate the corresponding fingerprint. Artifact substitution invalidates the selected generation. Old snapshots are not silently relabeled current. A dependency-injected test compiler is marked test-only and is refused by current-context retrieval.

For **metadata-only sources**, content is deliberately not hashed: a same-size content edit with the canonical modification timestamp restored can remain undetected. This includes blocked/review-only paths and policy-allowed files that the canonical filesystem adapter downgrades because they are non-text or exceed `max_file_bytes`. Their effective classification, reason, size, truncated modification time and canonical metadata fingerprint are sealed. An mtime-only change therefore invalidates their generation even when bytes stay the same. This is metadata consistency, not verification of restricted content.

## Scope and limits

The source inventory reuses Core's allow/block and directory-skip functions and the canonical filesystem adapter's `metadataDisposition` helper. Only effectively content-admitted files are content-hashed. Metadata-only sources are inventoried without opening their contents, and built-in summary adapters apply the same admission before opening a source. The local configuration is independently content-hashed because compilation consumes it even when its source disposition is restricted; the same 2 MiB per-file bound applies to it. Nested Git repositories and generated ECF directories are excluded. Limits are 10,000 encountered entries, 2 MiB per content-hashed source, and 64 MiB total content-read bytes, with a separate bounded metadata inventory. A large metadata-only file does not require content allocation. Unreadable content-admitted inputs or exceeded freshness bounds fail rather than silently becoming fresh. Output verification is bounded to 32 JSON artifacts of at most 8 MiB each.

The compiler fingerprint covers installed `src/**/*.js`, package metadata, and a lockfile when present. It is not a signed package attestation or a complete operating-system/dependency inventory. Only the canonical built-in local compilation path is supported; custom/external adapters, alternate config paths, distributed filesystems, and hostile concurrent filesystem writers are not qualified.

The seal detects local consistency changes, not authorship or malicious replacement by an actor controlling the entire private workspace. File/directory checks reduce accidental aliasing; they are not a sandbox or a defense against a privileged concurrent local attacker. Source reads are bounded observations rather than a filesystem-wide transactional snapshot. A process can change the source after a successful read. Downstream execution must retain its own current policy/authority checks.

Generations may contain private source previews and local paths. Keep `.ecf-core` ignored and never publish it or its output by default. The status result is not certification, agent completion, context consumption, deployment, or payment proof. `host_consumption_verified` remains false. POSIX creation modes are owner-only where supported; Windows ACL equivalence is not claimed.

## Recovery

Only one cooperating refresh may own `.ecf-core/fresh/.lock`. A conflicting refresh fails instead of stealing it. Normal success/failure removes only that lock. A killed process can leave the lock and an unselected partial generation; inspect the process and artifact state before an owner removes a stale lock. No automated recursive cleanup or last-good fallback is included. Failed generations do not replace the selected pointer. Atomic rename is not a universal power-loss durability guarantee.

## Verification and next integration

```sh
node --test tests/freshness-snapshot.test.js tests/freshness-compile.test.js tests/freshness-review.test.js tests/freshness-disposition.test.js
npm test
npm run check
npm run docs:check
```

The disposition regressions compare real canonical records against snapshot metadata hashes, exercise binary/oversized mtime-only stale-read refusal, forbid metadata-only content opens through the real compiler and every built-in summary adapter, cover sparse sources above the content-read ceiling, retain post-read growth checks, enforce the configuration boundary, and explicitly test the restored-timestamp limitation. Full current-head CI and independent review are required before merge; earlier local source-subset test counts are historical, not current-head execution evidence.

Before long-lived MCP embedding, resolve compiler execution isolation in issue #46; an on-disk digest does not invalidate Node's already loaded module graph. Use fresh CLI processes for this opt-in path. The next integration is an explicitly selected MCP current-context mode with host-consumption evidence and compatibility tests. Do not claim the current MCP cache issue is fully fixed by this opt-in CLI. Memory may consume the bounded status/generation reference through its existing explicit evidence path; this patch does not silently inject or write Memory context.
