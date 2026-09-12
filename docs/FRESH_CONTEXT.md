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

A same-size edit with a restored timestamp, an allowed-source addition/deletion, changed configuration, or changed JavaScript compiler source invalidates the corresponding fingerprint. Artifact substitution invalidates the selected generation. Old snapshots are not silently relabeled current. A dependency-injected test compiler is marked test-only and is refused by current-context retrieval.

## Scope and limits

The source inventory reuses Core's allow/block and directory-skip functions. It hashes allowed local source files plus the local configuration; it does not read blocked/review-only content. Nested Git repositories and generated ECF directories are excluded. Limits are 10,000 encountered entries, 2 MiB per inventoried source, and 64 MiB total source bytes. Output verification is bounded to 32 JSON artifacts of at most 8 MiB each. Oversized or unreadable inputs fail rather than silently becoming fresh.

The compiler fingerprint covers installed `src/**/*.js`, package metadata, and a lockfile when present. It is not a signed package attestation or a complete operating-system/dependency inventory. Only the canonical built-in local compilation path is supported; custom/external adapters, alternate config paths, distributed filesystems, and hostile concurrent filesystem writers are not qualified.

The seal detects local consistency changes, not authorship or malicious replacement by an actor controlling the entire private workspace. File/directory checks reduce accidental aliasing; they are not a sandbox or a defense against a privileged concurrent local attacker. Source reads are bounded observations rather than a filesystem-wide transactional snapshot. A process can change the source after a successful read. Downstream execution must retain its own current policy/authority checks.

Generations may contain private source previews and local paths. Keep `.ecf-core` ignored and never publish it or its output by default. The status result is not certification, agent completion, context consumption, deployment, or payment proof. `host_consumption_verified` remains false. POSIX creation modes are owner-only where supported; Windows ACL equivalence is not claimed.

## Recovery

Only one cooperating refresh may own `.ecf-core/fresh/.lock`. A conflicting refresh fails instead of stealing it. Normal success/failure removes only that lock. A killed process can leave the lock and an unselected partial generation; inspect the process and artifact state before an owner removes a stale lock. No automated recursive cleanup or last-good fallback is included. Failed generations do not replace the selected pointer. Atomic rename is not a universal power-loss durability guarantee.

## Verification and next integration

```sh
node --test tests/freshness-snapshot.test.js tests/freshness-compile.test.js
npm test
npm run check
npm run docs:check
```

Eight source-snapshot tests passed locally on Linux / Node 22.16.0 using the exact existing Core policy module (blob `9925b908f3d0222988c4d1473687cd96bcd8a79d`). The canonical compile/refresh tests were added to the existing test glob but could not be run in the source-subset environment. Full current-head CI and independent review are required before merge.

The next integration is an explicitly selected MCP current-context mode reusing `inspectFresh`, with host-consumption evidence and compatibility tests. Do not claim the current MCP cache issue is fully fixed by this opt-in CLI. Memory may consume the bounded status/generation reference through its existing explicit evidence path; this patch does not silently inject or write Memory context.
