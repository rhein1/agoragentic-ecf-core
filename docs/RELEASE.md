# Release Checklist

Use this checklist before any tagged release or package publication.

## Required Checks

```bash
npm test
npm run check
npm run pack:dry
npm run release:dry
```

## Manual Review

- Confirm the README does not claim SOC 2, audit status, enterprise readiness, hosted Agent OS runtime, wallet settlement, or Full ECF internals.
- Confirm examples do not include secrets, private customer data, local databases, or generated `.ecf-core/` artifacts.
- Confirm `npm pack --dry-run` only includes public package files.
- Confirm the package can compile a clean local fixture.
- Confirm CodeQL and Dependabot configuration are present.
- Confirm the Agent OS preview check passes on at least one fixture.

## Versioning

Use semantic versioning. See [Versioning And Compatibility](VERSIONING.md).

## Publishing Boundary

Publishing this package does not publish Agent OS, Router, marketplace, settlement, or Full ECF private infrastructure.

## Publish

```bash
npm publish --access public
git tag v1.1.0
git push origin v1.1.0
```

If publishing from GitHub Actions with trusted publishing enabled, prefer:

```bash
npm publish --access public --provenance
```
