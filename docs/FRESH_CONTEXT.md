# Opt-in current-context compilation and retrieval

Status: implementation candidate. This is a local CLI path over the existing ECF compiler, not a replacement compiler, database, automatic refresh daemon, or production context service. Existing `ecf-core` commands and MCP retrieval are unchanged. They do not acquire freshness guarantees merely because this module exists.

## Commands

Run from this source checkout using Node 20 or newer:

```sh
node scripts/fresh-context.cjs compile /path/to/project
node scripts/fresh-context.cjs status /path/to/project
node scripts/fresh-context.cjs read /path/to/project
```

`compile` is an explicit local write. It invokes the canonical `compileProject` in a fresh Node child with the project's `ecf.config.json`, writes ordinary ECF artifacts into a new private generation under `.ecf-core/fresh/`, checks source/configuration/compiler identity before and after, hashes the output artifacts, and atomically selects the generation only after those checks pass. The parent owns the lock and selected pointer. After the compiler child exits successfully, a second fresh child checks source/configuration and artifacts again without invoking the compiler, covering pending compiler callbacks that ran after compilation returned.

`status` checks the selected generation without returning source content. `read` additionally returns its ordinary `ecf-core.context-packet.v1` only when the checks pass. Neither command refreshes or changes the selected generation. Stale or unavailable evidence returns `context:null`; non-fresh CLI results exit 2. Compilation failures exit 1.

For **content-hashed sources**, same-size edits are detected even when timestamps are restored. Source additions/deletions, changed configuration, changed canonical source metadata, changed compiler/dependency bytes or changed Node runtime identity invalidate the corresponding fingerprint. Artifact substitution invalidates the selected generation. Old snapshots are not silently relabeled current. A dependency-injected test compiler is marked test-only and is refused by current-context retrieval.

For **metadata-only sources**, content is deliberately not hashed: a same-size content edit with the canonical modification timestamp restored can remain undetected. This includes blocked/review-only paths and policy-allowed files that the canonical filesystem adapter downgrades because they are non-text or exceed `max_file_bytes`. Their effective classification, reason, size, truncated modification time and canonical metadata fingerprint are sealed. An mtime-only change therefore invalidates their generation even when bytes stay the same. This is metadata consistency, not verification of restricted content.

## Scope and limits

The source inventory reuses Core's allow/block and directory-skip functions and the canonical filesystem adapter's `metadataDisposition` helper. Only effectively content-admitted files are content-hashed. Metadata-only sources are inventoried without opening their contents, and built-in summary adapters apply the same admission before opening a source. The local configuration is independently content-hashed because compilation consumes it even when its source disposition is restricted; the same 2 MiB per-file bound applies to it. Nested Git repositories and generated ECF directories are excluded. Limits are 10,000 encountered entries, 2 MiB per content-hashed source, and 64 MiB total content-read bytes, with a separate bounded metadata inventory. A large metadata-only file does not require content allocation. Unreadable content-admitted inputs or exceeded freshness bounds fail rather than silently becoming fresh. Output verification is bounded to 32 JSON artifacts of at most 8 MiB each.

The compiler fingerprint covers installed `src/**/*.js` and `src/**/*.json`, package metadata, a lockfile when present, and Node executable bytes plus runtime version/platform/architecture metadata. The child executes the exact captured JavaScript/JSON buffers in a new CommonJS graph and records each loaded local module's digest in the seal's `execution` field. The bootstrap is also bound to the exact bytes supplied to Node. Local code is bounded to 2,000 encountered entries, 2 MiB per file and 64 MiB total; the executable is streamed with a 256 MiB ceiling. External dependencies, native addons, dynamic imports and other source file types fail closed in this opt-in path. The current canonical compiler has no external package dependencies. Node builtins are bound through the executable/runtime identity; dynamically linked OS libraries are not inventoried. This is not a signed package or operating-system attestation.

The child inherits neither parent Node flags nor `NODE_OPTIONS`/`NODE_PATH`. Configuration, policy, filesystem disposition and both source snapshots use the same fresh graph as compilation. `inspectFresh` also runs in a fresh child so a parent's cached policy/configuration cannot authorize retrieval. Compiler/runtime identity is checked again after the child finishes. Pre-isolation seals require an explicit refresh.

Only the canonical built-in local compilation path is supported; custom/external adapters, alternate config paths, distributed filesystems, and hostile concurrent filesystem writers are not qualified. The buffered module loader establishes execution identity, not a sandbox for malicious compiler code or its builtins.

The seal detects local consistency changes, not authorship or malicious replacement by an actor controlling the entire private workspace. File/directory checks reduce accidental aliasing; they are not a sandbox or a defense against a privileged concurrent local attacker. Source reads are bounded observations rather than a filesystem-wide transactional snapshot. A process can change the source after a successful read. Downstream execution must retain its own current policy/authority checks.

Generations may contain private source previews and local paths. Keep `.ecf-core` ignored and never publish it or its output by default. The status result is not certification, agent completion, context consumption, deployment, or payment proof. `host_consumption_verified` remains false. POSIX creation modes are owner-only where supported; Windows ACL equivalence is not claimed.

## Recovery

Only one cooperating refresh may own `.ecf-core/fresh/.lock`. A conflicting refresh fails instead of stealing it. Each refresh records a random owner token and checks it and the original directory identity before promotion or lock removal. A replaced lock is left untouched. Normal failure removes only the attempt's unselected generation, after its child has closed; the existing selected pointer remains unchanged.

`compileFresh(root, { timeoutMs, signal })` accepts an integer deadline of 1–300,000 ms (default 30,000 ms) across the compiler and verification child stages, and an optional standard `AbortSignal`. Timeout/cancellation forcibly terminates the child and waits for `close` before cleanup. Child stdout is limited to 4 MiB and stderr to 64 KiB; diagnostics are discarded and failures return bounded error codes. Synchronous inspection has a 30-second child timeout and 10 MiB buffer limit. Local fingerprinting and cleanup also take bounded work outside the child timer.

Killing the parent or machine can still leave a lock and an unselected partial generation; inspect process and artifact state before an owner removes a stale lock. There is no stale-lock stealing, automatic last-good fallback, or universal power-loss durability guarantee.

## Verification and next integration

```sh
node --test tests/freshness-snapshot.test.js tests/freshness-compile.test.js tests/freshness-review.test.js tests/freshness-disposition.test.js tests/freshness-isolation.test.js
npm test
npm run check
npm run docs:check
```

The disposition regressions compare real canonical records against snapshot metadata hashes, exercise binary/oversized mtime-only stale-read refusal, forbid metadata-only content opens through the real compiler and every built-in summary adapter, cover sparse sources above the content-read ceiling, retain post-read growth checks, enforce the configuration boundary, and explicitly test the restored-timestamp limitation. Full current-head CI and independent review are required before merge; earlier local source-subset test counts are historical, not current-head execution evidence.

`tests/freshness-isolation.test.js` addresses issue #46 using disposable copies of the real compiler: parent loads A, disk changes to compiler/dependency B, and refresh executes B with bound bytes. It covers JS and JSON dependencies, source/config/compiler drift, pending child work, failure cleanup, timeout/cancellation, replacement locks, output bounds and preload exclusion. Filesystem-spy assertions for canonical source admission and marker read counts still invoke the real `compileProject` locally; parent spies do not claim to observe a child's reads.

Compiler isolation is an implementation candidate requiring exact-head CI and review. It does not activate long-lived MCP current-context consumption. The next integration is an explicitly selected MCP mode with host-consumption evidence and compatibility tests. Do not claim the current MCP cache issue is fully fixed by this opt-in path. Memory may consume the bounded status/generation reference through its existing explicit evidence path; this patch does not silently inject or write Memory context.
