# Fresh-context independent-review corrections

PR #45 now applies directory-skip rules only to directories, matching `walkFiles`. Allowed regular files such as `temp-context.js` are included and content changes invalidate the generation.

Snapshots also seal a bounded `restricted_inventory` of path, policy classification/reason, size and truncated modification time for blocked and review-required regular files. These are the metadata fields used by the canonical filesystem adapter; their content is neither opened nor hashed. Adding, removing, resizing or changing the classification of such a source invalidates the old canonical artifacts. Generated directories and directories skipped by the canonical walker remain excluded. The 10,000-entry bound and a 1 MiB serialized inventory ceiling apply before sealing. This is not a fingerprint of restricted file contents: same-metadata blocked-content changes are deliberately not detectable, because the canonical restricted record does not contain that content either.

Existing snapshots have no restricted inventory and must be explicitly refreshed. No automatic migration or default MCP activation is added. The source CLI continues to report fresh with exit 0 and stale/unknown with exit 2; returned stale context is null.

`tests/freshness-review.test.js` adds four snapshot regressions, canonical walker parity, two real-compiler regressions, and a source CLI end-to-end test. The local source-subset run exercised the four snapshot cases using the unchanged policy blob `9925b908f3d0222988c4d1473687cd96bcd8a79d`; canonical compiler/CLI verification belongs to current-head CI, not that local result.

Long-lived in-process compilation remains a separate gate: Node's module cache can preserve previously loaded compiler behavior after its on-disk files change. Use fresh CLI processes and do not embed this refresh API into a long-lived MCP process until compiler execution is isolated and tested against on-disk identity. A follow-up issue tracks that boundary.
