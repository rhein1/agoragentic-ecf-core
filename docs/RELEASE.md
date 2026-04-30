# Release Checklist

ECF Core is not published to npm yet. Use this checklist before any tagged release or package publication.

## Required Checks

```bash
npm test
npm run check
npm run pack:dry
```

## Manual Review

- Confirm the README does not claim SOC 2, audit status, enterprise readiness, hosted Agent OS runtime, wallet settlement, or Full ECF internals.
- Confirm examples do not include secrets, private customer data, local databases, or generated `.ecf-core/` artifacts.
- Confirm `npm pack --dry-run` only includes public package files.
- Confirm the package can compile a clean local fixture.

## Versioning

Use `0.x` while the compiler and adapter contracts are stabilizing.

## Publishing Boundary

Publishing this package does not publish Agent OS, Router, marketplace, settlement, or Full ECF private infrastructure.
